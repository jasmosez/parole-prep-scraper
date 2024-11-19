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


console.log(process.env.AIRTABLE_API_KEY)

Airtable.configure({ 
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY 
});
const base = Airtable.base('appqmaQOPMbOcRutu');


const lookupDIN = async (din) => {
    // Lookup DIN in NYC DOCCS    
        try{
            const resp = await fetch("https://nysdoccslookup.doccs.ny.gov/IncarceratedPerson/SearchByDin", {
                "headers": {
                  "accept": "*/*",
                  "accept-language": "en-US,en;q=0.9",
                  "content-type": "application/json; charset=utf-8",
                  "sec-ch-ua": "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"",
                  "sec-ch-ua-mobile": "?0",
                  "sec-ch-ua-platform": "\"macOS\"",
                  "sec-fetch-dest": "empty",
                  "sec-fetch-site": "same-origin",
                },
                "body": "\"07A4571\"",
                "method": "POST"
              });
            // const resp = await fetch('https://rickandmortyapi.com/api/character/476')
            const data = await resp.json()
            console.log(data)
        } catch(err){
            console.log(err)

        }
}


base('Table 1').select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 3,
    view: "Grid view"
}).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
        const din = record.get('DIN');
        console.log('Retrieved', din);
        lookupDIN(din)

        // update record
        // record.patchUpdate({ 'Age': '33' }, function (err) {
        //     if (err) {
        //         console.error(err);
        //         return;
        //     }
        //     console.log('Updated', record.get('DIN'));
        // }   );

    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

}, function done(err) {
    if (err) { console.error(err); return; }
});



