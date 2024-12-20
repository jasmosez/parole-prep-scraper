/**
 * SCRIPT OVERVIEW
 * 
 * Read from AirTable
 * Get lookup data from NYC DOCCS by DIN number
 * Compare the two data sets
 * Write to AirTable
 * Output a report of the changes
 */

import 'dotenv/config';
import { lookupDIN, validateDIN, CurlEmptyResponseError, delay } from './curl-utils.js';
import { DIN, DOCCS_TO_AIR } from './data-mapping.js';
import { RecordOutcome, report } from './report.js';
import { airtable } from './airtable-service.js';

const processBatch = async (records, startIndex, batchSize, totalRecords) => {
    const batch = records.slice(startIndex, startIndex + batchSize);
    await Promise.all(batch.map((record, index) => 
        processRecord(record, startIndex + index, totalRecords)
    ));
};

const processRecord = async (record, currentIndex, totalRecords) => {
    const countString = `[${currentIndex + 1}/${totalRecords}]`;
    const din = record.get(DIN)?.trim();
    console.log(`${countString} Processing DIN`, din);

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
        const changes = calculateChanges(record, data);
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

const calculateChanges = (record, data) => {
    const changes = [];
    for (const [doccsKey, fieldMapping] of Object.entries(DOCCS_TO_AIR)) {
        const fieldName = airtable.getFieldName(fieldMapping.id);
        //TODO: raise error if fieldName is not found
        if (!fieldName) continue;
        
        const airtableValue = record.get(fieldName);
        const doccsValue = getDoccsValue(data, doccsKey, fieldMapping);
        
        if (!fieldMapping.test(airtableValue, doccsValue)) {
            changes.push({
                field: fieldName,
                oldValue: airtableValue,
                newValue: fieldMapping.update(doccsValue)
            });
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
            await airtable.updateRecord(record, changes);
            report.addRecord({
                recordId: record.id,
                din,
                outcome: RecordOutcome.CHANGED,
                changes
            });
        } else {
            report.addRecord({
                recordId: record.id,
                din,
                outcome: RecordOutcome.NO_CHANGE,
                changes
            });
        }
    } catch (error) {
        report.addRecord({
            recordId: record.id,
            din,
            outcome: RecordOutcome.UPDATE_FAILED,
            message: error.message,
            changes
        });
    }
};

const run = async () => {
    await airtable.initialize();
    
    try {
        const records = airtable.getAllRecords().sort(() => Math.random() - 0.5);
        const BATCH_SIZE = 50;
        const BATCH_DELAY = 10000;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
            console.log(`Processing batch ${batchIndex} starting at index ${i}`);
            
            const start = new Date();
            await processBatch(records, i, BATCH_SIZE, records.length);
            const end = new Date();
            
            // Add batch timing to report
            report.addBatchTime(batchIndex, start, end);
            
            if (i + BATCH_SIZE < records.length) {
                console.dir(report.getSummary(), { depth: null, colors: true });
                console.log(`Waiting ${BATCH_DELAY}ms before processing next batch...`);
                await delay(BATCH_DELAY);
            }
        }

        console.log('Processing complete. Final report:', report);
    } catch (err) {
        console.error('Error processing records:', err);
    }
};

// Execute the script
(async () => {
    try {
        await run();
    } catch (err) {
        console.error('Script failed:', err);
    }
})();  

