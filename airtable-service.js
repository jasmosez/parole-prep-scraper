import Airtable from 'airtable';
import { getAirtableBaseSchema } from './curl-utils.js';
import { logger } from './logger.js';
import { DOCCS_TO_AIR } from './data-mapping.js';

export class AirtableService {
    constructor() {
        this.base = null;
        this.table = null;
        this.fields = null;
        this.records = null;
        this.validatedMappings = null;
        this.config = null;
    }

    async initialize() {
        this.config = {
            apiKey: process.env.AIRTABLE_API_KEY,
            baseId: process.env.AIRTABLE_BASE_ID,
            tableId: process.env.AIRTABLE_TABLE_ID,
            view: process.env.AIRTABLE_VIEW
        };

        if (!this.config.apiKey || !this.config.baseId || !this.config.tableId || !this.config.view) {
            throw new Error('Missing required environment variables');
        }

        this.base = new Airtable({ apiKey: this.config.apiKey }).base(this.config.baseId);
        this.table = this.base(this.config.tableId);
        this.records = await this.base(this.config.tableId).select({
            view: this.config.view
        }).all();

        await this.loadFields();
        this.validatedMappings = this.validateFieldMappings();
        logger.info('Airtable service initialized');
    }

    validateFieldMappings() {
        const validatedMappings = {};
        
        for (const [doccsKey, fieldMapping] of Object.entries(DOCCS_TO_AIR)) {
            const fieldName = this.getFieldName(fieldMapping.id);
            if (!fieldName) {
                logger.error('Critical configuration error: Field mapping not found', { 
                    fieldId: fieldMapping.id, 
                    doccsKey 
                });
                throw new Error(`Field mapping not found for ID: ${fieldMapping.id}`);
            }
            validatedMappings[doccsKey] = {
                ...fieldMapping,
                fieldName
            };
        }
        
        logger.info('Field mappings validated successfully', { 
            mappingCount: Object.keys(validatedMappings).length 
        });
        
        return validatedMappings;
    }

    getAllValidatedMappings() {
        if (!this.validatedMappings) {
            throw new Error('Airtable service not initialized');
        }
        return this.validatedMappings;
    }

    async loadFields() {
        const airtableSchema = await getAirtableBaseSchema(this.config.baseId, this.config.apiKey);
        const table = airtableSchema.tables?.find(table => table.id === this.config.tableId);
        
        if (!table) {
            throw new Error(`Table with ID ${this.config.tableId} not found in schema`);
        }
        
        this.fields = table.fields || [];
    }

    getFieldName(fieldId) {
        const field = this.fields.find(field => field.id === fieldId);
        if (!field) {
            logger.warn(`Field mapping not found`, { fieldId });
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