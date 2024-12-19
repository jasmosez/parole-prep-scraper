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
import Airtable from 'airtable';
import { getAirtableBaseSchema, lookupDIN, validateDIN, CurlEmptyResponseError, delay } from './curl-utils.js';

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_VIEW} = process.env;

// Add helper function
const toTitleCase = (str) => {
    return str.split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

const convertToDecimalYears = (sentence) => {
    if (!sentence) return '';
    
    // Expected format: "x years, y months, z days" or variations
    const parts = sentence.toLowerCase().match(/(\d+)\s*years?|(\d+)\s*months?|(\d+)\s*days?/g);
    if (!parts) return sentence.trim(); // Return original string if we can't parse it

    let years = 0;
    parts.forEach(part => {
        if (part.includes('year')) {
            years += parseInt(part);
        } else if (part.includes('month')) {
            years += parseInt(part) / 12;
        } else if (part.includes('day')) {
            years += parseInt(part) / 365;
        }
    });
    return Number(years.toFixed(2));
};

// Map DOCCS data to Airtable fields
const DIN = 'DIN'
const DOCCS_TO_AIR = {
    'facility': {
        id: 'fldBgfrJtoRM2NY9s', //'Housing / Releasing Facility'
        test: (air, doccs) => air?.includes(toTitleCase(doccs)),
        update: (doccs) => [toTitleCase(doccs)]

    },
    'paroleHearingDate': {
        id: 'fldptoJdU40n5dlO7', //Next Interview Date [DOCCS]
        test: (air, doccs) => air === new Date(doccs.slice(0,3) + '01/' + doccs.slice(3)).toISOString().split('T')[0],
        update: (doccs) => new Date(doccs.slice(0,3) + '01/' + doccs.slice(3)).toISOString().split('T')[0]
    },   
    'releaseDate': {
        id: 'flduQFFHqzBME4Ml1', //Latest Release Date / Type (Released People Only) [DOCCS]
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'sentence': {
        id: 'fldAx3FzIpIkZrmLA', // 'Sentence'
        test: (air, doccs) => {
            const { minSentence, maxSentence } = doccs;
            const minValue = convertToDecimalYears(minSentence);
            const maxValue = convertToDecimalYears(maxSentence);
            const expectedFormat = `${minValue} - ${maxValue}`;
            return air === expectedFormat;
        },
        update: (doccs) => {
            const { minSentence, maxSentence } = doccs;
            const minValue = convertToDecimalYears(minSentence);
            const maxValue = convertToDecimalYears(maxSentence);
            return `${minValue} - ${maxValue}`;
        },
        requiredFields: ['minSentence', 'maxSentence']
    },
    'county': {
        id: 'fldOc0FgeFDZhxj8n', //'County'
        test: (air, doccs) => air === toTitleCase(doccs),
        update: (doccs) => toTitleCase(doccs)
    },
    // 'race': {
    //     id: '', //'Race'
    //     test: (air, doccs) => air === doccs,
    //     update: (doccs) => doccs
    // },
    'paroleHearingType': {
        id: 'fld1W4lMm0iLcV9ui', //'Parole Interview Type'
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    // 'paroleEligDate': {
    //     id: '', //'Parole Eligibility Date'
    //     test: (air, doccs) => air === doccs,
    //     update: (doccs) => doccs
    // },
    'earliestReleaseDate': {
        id: 'fldzGsyKz7ZNV9S7A', //'Earliest Release Date'
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'dateOfBirth': {
        id: 'fldmVco0UMW7hxj4I', //'Date of Birth'
        test: (air, doccs) => air === new Date(doccs).toISOString().split('T')[0],
        update: (doccs) => new Date(doccs).toISOString().split('T')[0]
    },
}

// Initialize as empty object first
let airtableFields = {};
async function initializeFieldMappings() {
    const tables = (await getAirtableBaseSchema(AIRTABLE_BASE_ID, AIRTABLE_API_KEY)).tables;
    const table = tables.find(table => table.id === AIRTABLE_TABLE_ID);
    return table.fields
}

// Define outcome types as an enum-like object for better type safety
const RecordOutcome = {
  INVALID_DIN: 'INVALID_DIN',
  ERROR_RESPONSE: 'ERROR_RESPONSE',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  NO_CHANGE: 'NO_CHANGE',
  CHANGED: 'CHANGED',
  UPDATE_FAILED: 'UPDATE_FAILED'
};

// Main report structure - one entry per record
const report = {
  records: {}, // Keyed by recordId
  summary: {   // For quick stats
    total: 0,
    byOutcome: {},
    byFieldChange: {}
  }
};

const addToReport = ({
  recordId, 
  din, 
  outcome, 
  message = '', 
  changes = [] // Array of field changes
}) => {
  if (!Object.values(RecordOutcome).includes(outcome)) {
    throw new Error(`Invalid outcome: ${outcome}`);
  }

  // Initialize record entry
  report.records[recordId] = {
    din,
    outcome,
    message,
    changes,
    timestamp: new Date().toISOString()
  };

  // Update summary counts
  report.summary.total++;
  report.summary.byOutcome[outcome] = (report.summary.byOutcome[outcome] || 0) + 1;
  
  // Track field-level changes
  if (outcome === RecordOutcome.CHANGED) {
    changes.forEach(({field, oldValue, newValue}) => {
      if (!report.summary.byFieldChange[field]) {
        report.summary.byFieldChange[field] = 0;
      }
      report.summary.byFieldChange[field]++;
    });
  }

  console.log(`Added to report: ${outcome} ${recordId} ${din} ${message}`);
};

async function updateAirtableRecord(record, changes) {
    console.log('Updating record:', record.id);
    // // Convert changes array to Airtable's expected format
    // const updateFields = changes.reduce((acc, change) => {
    //     acc[change.field] = change.newValue;
    //     return acc;
    // }, {});

    // // Attempt to update the record
    // return await record.updateFields(updateFields);
}

const processBatch = async (records, startIndex, batchSize, totalRecords) => {
    const batch = records.slice(startIndex, startIndex + batchSize);
    
    await Promise.all(batch.map(async (record, index) => {
        const countString = `[${startIndex + index + 1}/${totalRecords}]`;
        const din = record.get(DIN).trim();
        console.log(`${countString} Processing DIN`, din);

        if (!validateDIN(din)) {
            return addToReport({ 
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
            return addToReport({ 
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
            const fieldName = airtableFields.find(field => field.id === fieldMapping.id).name;
            if (!fieldName) {
                console.error(`Field mapping not found for ${fieldMapping.id}`);
                continue;
            }
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
                await updateAirtableRecord(record, changes);
                addToReport({
                    recordId: record.id,
                    din,
                    outcome: RecordOutcome.CHANGED,
                    changes
                });
            } else {
                addToReport({
                    recordId: record.id,
                    din,
                    outcome: RecordOutcome.NO_CHANGE,
                    changes
                });
            }
        } catch (error) {
            addToReport({
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
    // Initialize Airtable fields
    airtableFields = await initializeFieldMappings();
    
    // Initialize Airtable
    Airtable.configure({ 
        endpointUrl: 'https://api.airtable.com',
        apiKey: AIRTABLE_API_KEY 
    });
    
    const base = Airtable.base(AIRTABLE_BASE_ID);
    
    try {
        // Get all records
        const records = await base(AIRTABLE_TABLE_ID).select({
            view: AIRTABLE_VIEW
        }).all();

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
                console.log('report', report.summary);
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

// Get all records with a specific outcome
const getRecordsByOutcome = (outcome) => 
  Object.values(report.records).filter(r => r.outcome === outcome);

// Get all records where a specific field changed
const getRecordsByFieldChange = (fieldName) =>
  Object.values(report.records).filter(r => 
    r.changes?.some(change => change.field === fieldName)
  );

// Get summary statistics
const getSummary = () => report.summary;

