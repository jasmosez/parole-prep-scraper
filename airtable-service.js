import Airtable from 'airtable';
import { getAirtableBaseSchema } from './curl-utils.js';

export class AirtableService {
    constructor() {
        this.fields = null;
        this.base = null;
        this.records = null;
    }

    async initialize() {
        const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_VIEW } = process.env;
        
        // Initialize Airtable fields
        const airtableSchema = await getAirtableBaseSchema(AIRTABLE_BASE_ID, AIRTABLE_API_KEY);
        const table = airtableSchema.tables.find(table => table.id === AIRTABLE_TABLE_ID);
        this.fields = table.fields;

        // Initialize Airtable connection
        Airtable.configure({ 
            endpointUrl: 'https://api.airtable.com',
            apiKey: AIRTABLE_API_KEY 
        });
        
        this.base = Airtable.base(AIRTABLE_BASE_ID);

        // Get all records
        this.records = await this.base(AIRTABLE_TABLE_ID).select({
            view: AIRTABLE_VIEW
        }).all();
    }

    getFieldName(fieldId) {
        const field = this.fields.find(field => field.id === fieldId);
        if (!field) {
            console.error(`Field mapping not found for ${fieldId}`);
            return null;
        }
        return field.name;
    }

    getAllRecords() {
        return this.records;
    }

    async updateRecord(record, changes) {
        // TODO: Implement this
        // console.log('Updating record:', record.id, changes);
        // // Convert changes array to Airtable's expected format
        // const updateFields = changes.reduce((acc, change) => {
        //     acc[change.field] = change.newValue;
        //     return acc;
        // }, {});
    
        // // Attempt to update the record
        // return await record.updateFields(updateFields);
    }
}

// Create and export singleton instance
export const airtable = new AirtableService(); 