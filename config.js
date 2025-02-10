import 'dotenv/config';

export const ENV = {
    TEST: 'test',
    STAGING: 'staging',
    PRODUCTION: 'production'
}

const FIELD_MAPPINGS = {
    [ENV.PRODUCTION]: {
        facility: {
            id: 'fldBgfrJtoRM2NY9s',
            type: 'multipleSelects'
        },
        paroleHearingDate: {
            id: 'fldptoJdU40n5dlO7',
            type: 'date'
        },
        latestRelDate: {
            id: 'flduQFFHqzBME4Ml1',
            type: 'date'
        },
        sentence: {
            id: 'fldAx3FzIpIkZrmLA',
            type: 'text'
        },
        county: {
            id: 'fldOc0FgeFDZhxj8n',
            type: 'text'
        },
        race: {
            id: 'fldMbteGxI06RGghM',
            type: 'text'
        },
        paroleHearingType: {
            id: 'fld1W4lMm0iLcV9ui',
            type: 'text'
        },
        paroleEligDate: {
            id: 'fldQ6fmoi52aTsQmw',
            type: 'date'
        },
        earliestReleaseDate: {
            id: 'fldzGsyKz7ZNV9S7A',
            type: 'date'
        },
        earliestReleaseType: {
            id: 'fldpbewHhqDldY4vW',
            type: 'text'
        },
        dateOfBirth: {
            id: 'fldmVco0UMW7hxj4I',
            type: 'date'
        }
    },
    [ENV.STAGING]: {
        facility: {
            id: 'fldKGntODsYIBeOS8',
            type: 'multipleSelects'
        },
        paroleHearingDate: {
            id: 'fldyTwLi487jEEbxN',
            type: 'date'
        },
        latestRelDate: {
            id: 'fldDgNHMADIIdvC4H',
            type: 'date'
        },
        sentence: {
            id: 'fldJXbHEStPgyScug',
            type: 'text'
        },
        county: {
            id: 'fldXC8HloJKVQY9R3',
            type: 'text'
        },
        race: {
            id: 'fldVBBgLHM72q760s',
            type: 'text'
        },
        paroleHearingType: {
            id: 'fldamcnRw4pHLmZdY',
            type: 'text'
        },
        paroleEligDate: {
            id: 'fldZwnots996sTG5c',
            type: 'date'
        },
        earliestReleaseDate: {
            id: 'fldI6AAPJb6JuAIQg',
            type: 'date'
        },
        earliestReleaseType: {
            id: 'fldyBmyMruKhMpUeC',
            type: 'text'
        },
        dateOfBirth: {
            id: 'fldvlkq54Q33QY9No',
            type: 'date'
        }
    },
    [ENV.TEST]: {
        // Test environment mappings would go here
        // Using same structure as production but with different IDs
        facility: {
            id: 'fldyqHiZfLHnQnNG7',
            type: 'multipleSelects'
        },
        paroleHearingDate: {
            id: 'fldVdinPD2V8dpGQb',
            type: 'date'
        },
        latestRelDate: {
            id: 'fldw3U5tFxdrplE9G',
            type: 'date'
        },
        sentence: {
            id: 'fldGavIgPLs4s86Gv',
            type: 'text'
        },
        county: {
            id: 'fldfz22m7Ir1vuGWs',
            type: 'text'
        },
        race: {
            id: 'fldD55NmNGqxFsrM4',
            type: 'text'
        },
        paroleHearingType: {
            id: 'fldEIcJuHrhPpqeAd',
            type: 'text'
        },
        paroleEligDate: {
            id: 'fldgrSCo1R7KkW6ve',
            type: 'date'
        },
        earliestReleaseDate: {
            id: 'fldRit0cX7JknMNcA',
            type: 'date'
        },
        earliestReleaseType: {
            id: 'fldEIcJuHrhPpqeAd',
            type: 'text'
        },
        dateOfBirth: {
            id: 'fldSNGnkmWfUDItaJ',
            type: 'date'
        }
    }
};

const environment = process.env.ENV || ENV.TEST;

export const config = {
    airtable: {
        apiKey: (() => {
            switch(environment) {
                case ENV.PRODUCTION:
                    return process.env.AIRTABLE_API_KEY;
                case ENV.STAGING:
                    return process.env.STAGING_AIRTABLE_API_KEY;
                default:
                    return process.env.TEST_AIRTABLE_API_KEY;
            }
        })(),
        baseId: (() => {
            switch(environment) {
                case ENV.PRODUCTION:
                    return process.env.AIRTABLE_BASE_ID;
                case ENV.STAGING:
                    return process.env.STAGING_AIRTABLE_BASE_ID;
                default:
                    return process.env.TEST_AIRTABLE_BASE_ID;
            }
        })(),
        tableId: (() => {
            switch(environment) {
                case ENV.PRODUCTION:
                    return process.env.AIRTABLE_TABLE_ID;
                case ENV.STAGING:
                    return process.env.STAGING_AIRTABLE_TABLE_ID;
                default:
                    return process.env.TEST_AIRTABLE_TABLE_ID;
            }
        })(),
        view: (() => {
            switch(environment) {
                case ENV.PRODUCTION:
                    return process.env.AIRTABLE_VIEW;
                case ENV.STAGING:
                    return process.env.STAGING_AIRTABLE_VIEW;
                default:
                    return process.env.TEST_AIRTABLE_VIEW;
            }
        })(),
        batchSize: parseInt(process.env.BATCH_SIZE, 10) || 50,
        batchDelay: parseInt(process.env.BATCH_DELAY, 10) || 10000,
        fieldMappings: FIELD_MAPPINGS[environment]
    },
    fewerRecords: process.env.FEWER_RECORDS ? parseInt(process.env.FEWER_RECORDS, 10) : false,
    randomizeRecords: process.env.RANDOMIZE_RECORDS === 'true',
    enableTypecast: process.env.ENABLE_TYPECAST === 'true',
    enableUpdateRecords: process.env.ENABLE_UPDATE_RECORDS === 'true',
    environment: environment,
    googleCloud: {
        bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME
    },
    email: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT, 10),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        fromAddress: process.env.EMAIL_FROM_ADDRESS,
        staffReportTo: process.env.STAFF_REPORT_EMAIL_TO,
        staffReportSubject: process.env.STAFF_REPORT_EMAIL_SUBJECT || 'Staff Report'
    },
    debug: process.env.DEBUG === 'true'
}; 
