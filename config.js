import 'dotenv/config';

export const config = {
    airtable: {
        apiKey: process.env.AIRTABLE_API_KEY,
        baseId: process.env.AIRTABLE_BASE_ID,
        tableId: process.env.AIRTABLE_TABLE_ID,
        view: process.env.AIRTABLE_VIEW,
        batchSize: parseInt(process.env.BATCH_SIZE, 10) || 50,
        batchDelay: parseInt(process.env.BATCH_DELAY, 10) || 10000,
    }
}; 