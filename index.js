import fs from 'fs';
import 'dotenv/config';
import { lookupDIN, validateDIN, delay } from './curl-utils.js';
import { DIN } from './data-mapping.js';
import { RecordOutcome, report } from './report.js';
import { airtable } from './airtable-service.js';
import { logger } from './logger.js';
import { CurlEmptyResponseError } from './errors.js';
import { config } from './config.js';

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
                // TODO: not sure we need this even as a debug message
                // const message = `DOCCS field value missing. No update: ${fieldMapping.fieldName}`;
                // logger.debug(message);
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
            // Add specific field error to changes array instead of throwing
            // TODO: pretty sure we don't want this as it throws off our byFieldChange numbers
            // changes.push({
            //     field: fieldMapping.fieldName,
            //     error: error.message
            // });
            // Continue processing other fields instead of throwing
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
            changes
        });
        logger.error('Failed to update record', error, { din });
    }
};

const run = async () => {
    logger.info('🚀 Starting script', { 
        environment: config.environment, 
        fewerRecords: config.fewerRecords,
        enableUpdateRecords: config.enableUpdateRecords,
        enableTypecast: config.enableTypecast
    });
    
    await airtable.initialize();
    
    try {
        // take a snapshot of the base before we start
        await airtable.takeSnapshot();

        // get all records
        const records = config.fewerRecords 
            ? airtable.getAllRecords().sort(() => Math.random() - 0.5).slice(0, 100)
            : airtable.getAllRecords().sort(() => Math.random() - 0.5);
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
                logger.info(`Waiting before next batch`, { delay: BATCH_DELAY });
                await delay(BATCH_DELAY);
            }
        }

        logger.logReport(report, true);

        // dump the report and network analysis to a file with the current date and time
        const date = new Date().toISOString();
        const filename = `report-${config.environment}-${date}.json`;
        const reportData = {
            ...report,
            networkAnalysis: report.getNetworkAnalysis()
        };
        // Create tmp directory if it doesn't exist
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp');
        }
        fs.writeFileSync(`tmp/${filename}`, JSON.stringify(reportData, null, 2));

    } catch (err) {
        logger.error('Script failed:', err);
    }
};

// Execute the script
(async () => {
    try {
        await run();
    } catch (err) {
        logger.error('Script failed:', err);
    }
})();  

