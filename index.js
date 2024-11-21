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
import { lookupDIN } from './util.js';

// Initialize Airtable
Airtable.configure({ 
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY 
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Map DOCCS data to Airtable fields
const FIELD_MAP = {
    'din': 'DIN',
    'name': 'Name',
    'age': 'Age',
    'facility': 'Facility',
    'paroleHearingDate': 'Parole Interview Date',
    'paroleEligDate': 'Parole Eligibility Date',
    'status': 'Status',
}


base('Table 1').select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 3,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(async function(record) {
        const din = record.get('DIN');
        console.log('Retrieved', din);
        const doccsData = await lookupDIN(din)

        if (doccsData.error) {
            console.error('Error fetching data for', din);
            return;
        }

        // update record
        const {age, paroleEligDate, paroleHearingDate, status, facility} = doccsData;
        const newDetails = {
            [FIELD_MAP.age]: age.match(/\d+/)[0],
            [FIELD_MAP.paroleEligDate]: paroleEligDate,
            [FIELD_MAP.paroleHearingDate]: paroleHearingDate,
            [FIELD_MAP.status]: status,
            [FIELD_MAP.facility]: facility,
        }

        record.patchUpdate(newDetails, function (err) {
            if (err) {
                console.error(err);
                return;
            }
            console.log('Updated', record.get('DIN'));
        }   );

    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});



