import 'dotenv/config';
import { lookupDIN, validateDIN, delay } from './lib/curl-utils.js';
import { DIN } from './lib/data-mapping.js';
import { RecordOutcome, report } from './lib/report.js';
import { airtable } from './lib/airtable-service.js';
import { logger } from './lib/logger.js';
import { CurlEmptyResponseError } from './lib/errors.js';
import { config } from './config.js';
import { StorageService } from './lib/storage-service.js';
import { EmailService } from './lib/email-service.js';
const processBatch = async (records, startIndex, batchSize, totalRecords) => {
    const batch = records.slice(startIndex, startIndex + batchSize);
    await Promise.all(batch.map((record, index) => 
        processRecord(record, startIndex + index, totalRecords)
    ));
};

const processRecord = async (record, currentIndex, totalRecords) => {
    const din = record.get(DIN)?.trim();
    logger.logProgress(currentIndex + 1, totalRecords, din);

    // Validation step
    if (!validateDIN(din)) {
        return report.addRecord({
            recordId: record.id,
            din,
            outcome: RecordOutcome.INVALID_DIN,
            message: 'Invalid DIN format'
        });
    }

    // Data fetching step
    const data = await fetchAndValidateData(din, record.id);
    if (data.error) {
        return; // fetchAndValidateData handles error reporting
    }

    // Process changes
    const changes = await processChanges(record, data, din);
    if (changes.error) {
        return; // processChanges handles error reporting
    }
};

const fetchAndValidateData = async (din, recordId) => {
    try {
        const data = await lookupDIN(din);
        
        if (data.error) {
            const outcome = data.error === CurlEmptyResponseError.ERROR_NAME 
                ? RecordOutcome.EMPTY_RESPONSE 
                : RecordOutcome.ERROR_RESPONSE;
            report.addRecord({ 
                recordId, 
                din, 
                outcome,
                message: data.userDisplayableMessage 
            });
            return { error: true };
        }
        return data;
    } catch (error) {
        report.addRecord({
            recordId,
            din,
            outcome: RecordOutcome.PROCESSING_ERROR,
            message: `Error fetching data: ${error.message}`
        });
        return { error: true };
    }
};

const processChanges = async (record, data, din) => {
    try {
        const changes = calculateChanges(record, data, din);
        await updateRecordIfNeeded(record, changes, din);
        return { error: false };
    } catch (error) {
        report.addRecord({
            recordId: record.id,
            din,
            outcome: RecordOutcome.PROCESSING_ERROR,
            message: `Error processing changes: ${error.message}`
        });
        console.error(`Error processing changes for DIN ${din}:`, error);
        return { error: true };
    }
};

const calculateChanges = (record, data, din) => {
    const changes = [];
    const validatedMappings = airtable.getAllValidatedMappings();
    
    for (const [doccsKey, fieldMapping] of Object.entries(validatedMappings)) {
        try {
            const airtableValue = record.get(fieldMapping.fieldName);
            const doccsValue = getDoccsValue(data, doccsKey, fieldMapping);
            
            // Check if updating a value with an empty string
            if (!doccsValue || doccsValue === '') {
                continue;
            }

            if (!fieldMapping.test(airtableValue, doccsValue)) {
                const newValue = fieldMapping.update(doccsValue);
                // Validate the new value matches expected type
                airtable.validateFieldType(fieldMapping.fieldName, newValue);
                
                changes.push({
                    field: fieldMapping.fieldName,
                    oldValue: airtableValue,
                    newValue
                });
            }
        } catch (error) {
            logger.error('Error processing field', error, { 
                doccsKey, 
                din,
                recordId: record.id,
                field: fieldMapping.fieldName  // Add field name for better context
            });
            continue;
        }
    }
    return changes;
};

// Handles single field and multiple field mappings
const getDoccsValue = (data, doccsKey, fieldMapping) => {
    if (fieldMapping.requiredFields) {
        const doccsValue = {};
        for (const field of fieldMapping.requiredFields) {
            doccsValue[field] = data[field];
        }
        return doccsValue;
    }
    return data[doccsKey];
};

const updateRecordIfNeeded = async (record, changes, din) => {
    try {
        if (changes.length > 0) {
            config.enableUpdateRecords && await airtable.updateRecord(record, changes);
            report.addRecord({
                recordId: record.id,
                din,
                outcome: RecordOutcome.CHANGED,
                changes
            });
            logger.debug('Record updated', { din });
        } else {
            report.addRecord({
                recordId: record.id,
                din,
                outcome: RecordOutcome.NO_CHANGE,
                changes
            });
            logger.debug('No changes needed', { din });
        }
    } catch (error) {
        report.addRecord({
            recordId: record.id,
            din,
            outcome: RecordOutcome.UPDATE_FAILED,
            message: error.message,
            details: error.details?.error,
            changes
        });
        logger.error('Failed to update record', error, { din });
    }
};

export const run = async () => {
    logger.info('🚀 Starting script', { 
        environment: config.environment, 
        fewerRecords: config.fewerRecords,
        enableUpdateRecords: config.enableUpdateRecords,
        enableTypecast: config.enableTypecast
    });

    // Set configuration settings in report
    report.setConfigSettings(config);

    // Initialize storage service
    const storageService = new StorageService(config.googleCloud.bucketName);
    await storageService.validateCredentials();

    // Initialize Airtable
    await airtable.initialize();
    
    try {
        // take a snapshot of the base before we start
        await airtable.takeSnapshot();

        // get all records
        let records = airtable.getAllRecords()

        // randomize the records if enabled
        records = config.randomizeRecords ? records.sort(() => Math.random() - 0.5) : records;

        // limit the number of records if enabled
        records = config.fewerRecords ? records.slice(0, config.fewerRecords) : records;

        const BATCH_SIZE = config.airtable.batchSize;
        const BATCH_DELAY = config.airtable.batchDelay;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
            logger.logBatch(batchIndex, i, BATCH_SIZE);
            
            const start = new Date();
            await processBatch(records, i, BATCH_SIZE, records.length);
            const end = new Date();
            
            report.addBatchTime(batchIndex, start, end);
            
            if (i + BATCH_SIZE < records.length) {
                logger.logReport(report);
                // TODO: remove this once we deploy to prod
                logger.info(`Waiting before next batch`, { delay: BATCH_DELAY });
                await delay(BATCH_DELAY);
            }
        }

        // Log final report
        logger.logReport(report, true);

        // Create and save each report to Cloud Storage
        await storageService.saveReports(report, config.environment);
        
        // send an email to the team with the staff report
        const emailService = new EmailService();
        await emailService.sendPreconfiguredEmail(report.getTextReport());
        

        // if any of the fields corresponding to causeAlert === true, then log an alert
        // const alertFieldNames = Object.entries(airtable.getAllValidatedMappings())
        //     .filter(([_, field]) => field.causeAlert)
        //     .map(([_, field]) => field.fieldName);

        // if (Object.keys(report.summary.byFieldChange).some(field => alertFieldNames.includes(field))) {
        //     logger.info('Report contains causeAlert fields, sending preconfigured email', { causeAlert: true });
            
        //     // send an email to the team with the staff report
        //     const emailService = new EmailService();
        //     await emailService.sendPreconfiguredEmail(report.getTextReport());
        // }

    } catch (err) {
        logger.error('Script failed:', err);
        throw err; // Re-throw to ensure Cloud Function marks as failed
    }
};

// Run the script unless it's being imported as a module
if (process.argv[1] === new URL(import.meta.url).pathname) {
    (async () => {
        try {
            await run();
            process.exit(0);
        } catch (err) {
            logger.error('Script failed:', err);
            process.exit(1);
        }
    })();
}
  