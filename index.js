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
import { RecordOutcome, createReport } from './report.js';
import { airtable } from './airtable-service.js';

const report = createReport();

const processBatch = async (records, startIndex, batchSize, totalRecords) => {
    const batch = records.slice(startIndex, startIndex + batchSize);
    
    await Promise.all(batch.map(async (record, index) => {
        const countString = `[${startIndex + index + 1}/${totalRecords}]`;
        const din = record.get(DIN).trim();
        console.log(`${countString} Processing DIN`, din);

        if (!validateDIN(din)) {
            return report.addRecord({ 
                recordId: record.id, 
                din, 
                outcome: RecordOutcome.INVALID_DIN 
            });
        }
        
        // Get DOCCS Data
        const data = await lookupDIN(din);
        console.log(`${countString} Data length:`, Object.keys(data).length);
        
        if (data.error) {
            const outcome = data.error === CurlEmptyResponseError.ERROR_NAME 
                ? RecordOutcome.EMPTY_RESPONSE 
                : RecordOutcome.ERROR_RESPONSE;
            return report.addRecord({ 
                recordId: record.id, 
                din, 
                outcome,
                message: data.userDisplayableMessage 
            });
        }

        // When processing changes
        const changes = [];
        for (const [doccsKey, fieldMapping] of Object.entries(DOCCS_TO_AIR)) {
            // Get the airtable value
            const fieldName = airtable.getFieldName(fieldMapping.id);
            if (!fieldName) continue;
            
            const airtableValue = record.get(fieldName);
            
            // Get the DOCCS value
            let doccsValue;
            if (fieldMapping.requiredFields) {
                // Handle special case where multiple DOCCS fields are needed
                doccsValue = {};
                for (const field of fieldMapping.requiredFields) {
                    doccsValue[field] = data[field];
                }
            } else {
                // Handle normal case (single field)
                doccsValue = data[doccsKey];
            }
            
            // Compare the values
            const valuesMatch = fieldMapping.test(airtableValue, doccsValue);
            if (!valuesMatch) {
                const newValue = fieldMapping.update(doccsValue);
                changes.push({
                    field: fieldName,
                    oldValue: airtableValue,
                    newValue
                });
            }
        }

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
    }));
};

const run = async () => {
    // Initialize Airtable service
    await airtable.initialize();
    
    try {
        const records = airtable.getAllRecords();

        // Process records in batches
        const BATCH_SIZE = 50;
        const BATCH_DELAY = 10000; // 10 seconds between batches

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            console.log(`Processing batch starting at index ${i}`);
            
            const start = new Date();
            await processBatch(records, i, BATCH_SIZE, records.length);
            const end = new Date();
            
            // Add delay between batches if not the last batch
            if (i + BATCH_SIZE < records.length) {
                console.log(`Batch processing time: ${(end - start)/1000}s`);
                console.log('report', report.getSummary());
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

