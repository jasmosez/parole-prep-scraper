import fs from 'fs';
import 'dotenv/config';
import { lookupDIN, validateDIN, delay } from './curl-utils.js';
import { DIN } from './data-mapping.js';
import { RecordOutcome, report } from './report.js';
import { airtable } from './airtable-service.js';
import { logger } from './logger.js';
import { CurlEmptyResponseError } from './errors.js';
import { config } from './config.js';
import * as functions from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';

// Initialize storage client at the top of your file
const storage = new Storage();
const BUCKET_NAME = config.googleCloud.bucketName; 

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

export const run = async () => {
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

        // Save report to Cloud Storage
        const date = new Date().toISOString();
        const filename = `reports/report-${config.environment}-${date}.json`;
        const reportData = {
            ...report,
            networkAnalysis: report.getNetworkAnalysis()
        };

        // Upload to Cloud Storage
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(filename);
        
        await file.save(JSON.stringify(reportData, null, 2), {
            contentType: 'application/json',
            metadata: {
                createdAt: date,
                environment: config.environment
            }
        });

        logger.info(`Report saved to gs://${BUCKET_NAME}/${filename}`);
        
        // if any of the fields corresponding to causeAlert === true, then log an alert
        const alertFieldNames = Object.entries(airtable.getAllValidatedMappings()).filter(([_, field]) => field.causeAlert).map(([_, field]) => field.fieldName);
        if (Object.keys(report.summary.byFieldChange).some(field => alertFieldNames.includes(field))) {
            logger.info('Report contains causeAlert fields', { causeAlert: true });
        }

    } catch (err) {
        logger.error('Script failed:', err);
        throw err; // Re-throw to ensure Cloud Function marks as failed
    }
};

// TODO: each run is adding to the same Report instance. And we don't want that.
// Cloud Function handler
functions.http('runSync', async (req, res) => {
  // Verify the request is from Cloud Scheduler
  const bearer = req.header('Authorization');
  if (!bearer || !bearer.startsWith('Bearer ')) {
    logger.error('Unauthorized request');
    return res.status(403).send('Unauthorized');
  }

  try {
    logger.info('Starting scheduled sync');
    await run();
    res.status(200).send('Sync completed');
  } catch (error) {
    logger.error('Sync failed:', error);
    res.status(500).send('Sync failed');
  }
});

// Allow running directly with node
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      await run();
    } catch (err) {
      logger.error('Script failed:', err);
      process.exit(1);
    }
  })();
}

