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
import { getAirtableBaseSchema, lookupDIN, validateDIN, CurlEmptyResponseError } from './util.js';

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_VIEW} = process.env;

String.prototype.toTitleCase = function() {
    return this.split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

// Map DOCCS data to Airtable fields
const DIN = 'DIN'
const DOCCS_TO_AIR = {
    'facility': {
        id: 'fldBgfrJtoRM2NY9s', //'Housing / Releasing Facility'
        test: (air, doccs) => air.includes(doccs.toTitleCase())
    },
    'paroleHearingDate': {
        id: 'fldptoJdU40n5dlO7', //Next Interview Date [DOCCS]
        test: (air, doccs) => air === doccs.slice(0,3) + '01/' + doccs.slice(3)
    },   
    'releaseDate': {
        id: 'flduQFFHqzBME4Ml1', //Latest Release Date / Type (Released People Only) [DOCCS]
        test: (air, doccs) => air === doccs
    } 

    // Fields to Possibly Add
    // 'age': '', //'Age'
    // 'county': '', //'County of conviction'
    // 'race': '', //'Race'
    // 'paroleHearingType': '', //'Parole Interview Type'
    // 'paroleEligDate': '', //'Parole Eligibility Date'
    // 'earliestReleaseDate': '', //'Earliest Release Date'

    // FYI: 'minSentence and MaxSentence are combined to form  a value for 'fldAx3FzIpIkZrmLA' ('Sentence')
}

// get current Airtable field names
const table = getAirtableBaseSchema(AIRTABLE_BASE_ID, AIRTABLE_API_KEY).tables.find(table => table.id === AIRTABLE_TABLE_ID);
const AIRTABLE_FIELDS = Object.keys(DOCCS_TO_AIR).reduce((acc, doccsFieldId) => {
    const airtableFieldId = DOCCS_TO_AIR[doccsFieldId].id;
    const field = table.fields.find(field => field.id === airtableFieldId);
    acc[airtableFieldId] = field.name;
    return acc;
}, {});

// structure: type: {recordId: {message, oldData, newData}}
const INVALID_DIN = 'invalid_din';
const ERROR_RESPONSE = 'error_response';
const EMPTY_RESPONSE = 'empty_response';
const NO_CHANGE = 'no_change';
const CHANGED = 'changed';
const TYPES = [INVALID_DIN, ERROR_RESPONSE, EMPTY_RESPONSE, NO_CHANGE, CHANGED];
const report = TYPES.reduce((acc, type) => {
    acc[type] = {};
    return acc;
}, {});
const addToReport = ({type, recordId, din, message = '', oldData = {}, newData = {}}) => {
    if (!TYPES.includes(type)) {
        throw new Error(`Invalid report type: ${type}`);
    }

    if (report[type][recordId]) {
        report[type][recordId].oldData = {...report[type][recordId].oldData, ...oldData};
        report[type][recordId].newData = {...report[type][recordId].newData, ...newData};
    } else {
        report[type][recordId] = {din, message, oldData, newData};
    }

    console.log(`Added to report: ${type} ${recordId} ${din} ${message}`);
}


const run = () => {
    // Initialize Airtable
    Airtable.configure({ 
        endpointUrl: 'https://api.airtable.com',
        apiKey: AIRTABLE_API_KEY 
    });
    
    const base = Airtable.base(AIRTABLE_BASE_ID);    
    base(AIRTABLE_TABLE_ID).select({
        view: AIRTABLE_VIEW
    }).all().then(records => {
    
        records.forEach(function(record, index) {
            // Get DIN from Airtable
            const countString = `[${index + 1}/${records.length}]`;
            const din = record.get(DIN).trim();
            console.log(`${countString} DIN`, din);
    
            if (!validateDIN(din)) {
                return addToReport({ type: INVALID_DIN, recordId: record.id, din: din});
            }
            
            // Get DOCCS Data
            const data = lookupDIN(din)
            console.log(`${countString} Data length:`, Object.keys(data).length);
            if (data.error) {
                const err_type = data.error === CurlEmptyResponseError.ERROR_NAME ? EMPTY_RESPONSE : ERROR_RESPONSE;
                return addToReport({ type: err_type, recordId: record.id, din, message: data.userDisplayableMessage });
            }
      
            // Compare data
            let unchanged = true;
            for (const [doccsKey, airtableObj] of Object.entries(DOCCS_TO_AIR)) {
                const airtableFieldId = airtableObj.id;
                const test = airtableObj.test;
                const doccsValue = data[doccsKey];
                const airtableValue = record.get(AIRTABLE_FIELDS[airtableFieldId]);
                if (!test(airtableValue, doccsValue)) {
                    unchanged = false;
                    addToReport({
                        type: CHANGED, 
                        recordId: record.id, 
                        din, 
                        newData: {[AIRTABLE_FIELDS[airtableFieldId]]: doccsValue}, 
                        oldData: {[AIRTABLE_FIELDS[airtableFieldId]]: airtableValue}});
                }
            }
            unchanged && addToReport({type: NO_CHANGE, recordId: record.id, din});
            


    
    
            // update record
            // const {age, paroleEligDate, paroleHearingDate, status, facility} = doccsData;
            // const newDetails = {
            //     [FIELD_MAP.age]: age.match(/\d+/)[0],
            //     [FIELD_MAP.paroleEligDate]: paroleEligDate,
            //     [FIELD_MAP.paroleHearingDate]: paroleHearingDate,
            //     [FIELD_MAP.status]: status,
            //     [FIELD_MAP.facility]: facility,
            // }
    
            // record.patchUpdate(newDetails, function (err) {
            //     if (err) {
            //         console.error(err);
            //         return;
            //     }
            //     console.log('Updated', record.get('DIN'));
            // }   );
    
        });

    
    }, function done(err) {
        if (err) { console.error(err); return; }
    });
}

run();  


