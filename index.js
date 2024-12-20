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
        try {
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
        } catch (error) {
            report.addRecord({
                recordId: record.id,
                din,
                outcome: RecordOutcome.PROCESSING_ERROR,
                message: `Error processing changes: ${error.message}`
            });
            console.error(`Error processing changes for DIN ${din}:`, error);
        }
    }));
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

