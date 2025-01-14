import Airtable from 'airtable';
import { getAirtableBaseSchema } from './curl-utils.js';
import { logger } from './logger.js';
import { DOCCS_TO_AIR } from './data-mapping.js';
import { AirtableError, DataTypeError, FieldMappingError } from './errors.js';
import { config } from './config.js';

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
            apiKey: config.airtable.apiKey,
            baseId: config.airtable.baseId,
            tableId: config.airtable.tableId,
            view: config.airtable.view
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
                throw new AirtableError(`Field mapping not found for ID: ${fieldMapping.id}`);
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
            throw new AirtableError('Airtable service not initialized');
        }
        return this.validatedMappings;
    }

    async loadFields() {
        const airtableSchema = await getAirtableBaseSchema(this.config.baseId, this.config.apiKey);
        const table = airtableSchema.tables?.find(table => table.id === this.config.tableId);
        
        if (!table) {
            throw new AirtableError(`Table with ID ${this.config.tableId} not found in schema`);
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

    validateFieldType(fieldName, value) {
        const field = this.fields.find(f => f.name === fieldName);
        if (!field) {
            throw new FieldMappingError(`Field not found: ${fieldName}`);
        }

        try {
            switch(field.type) {
                case 'multipleSelects':
                    if (!Array.isArray(value)) {
                        throw new DataTypeError('Expected array for multipleSelects', { 
                            field: fieldName, 
                            value, 
                            expectedType: 'array' 
                        });
                    }
                    break;
                case 'number':
                    if (typeof value !== 'number') {
                        throw new DataTypeError('Expected number', { 
                            field: fieldName, 
                            value, 
                            expectedType: 'number' 
                        });
                    }
                    break;
                case 'date':
                    if (value !== '' && !(value instanceof Date) && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                        throw new DataTypeError('Expected date string (YYYY-MM-DD) or empty string', { 
                            field: fieldName, 
                            value, 
                            expectedType: 'date' 
                        });
                    }
                    break;
                case 'checkbox':
                    if (typeof value !== 'boolean') {
                        throw new DataTypeError('Expected boolean', { 
                            field: fieldName, 
                            value, 
                            expectedType: 'boolean' 
                        });
                    }
                    break;
                // Add other types as needed
            }
            return true;
        } catch (error) {
            logger.error('Field validation failed', error, { fieldName, value });
            throw error;
        }
    }

    async updateRecord(record, changes) {
        const updateFields = changes.reduce((acc, change) => {
            if (change.error) {
                return acc;
            }
            acc[change.field] = change.newValue;
            return acc;
        }, {});

        try {
            await this.table.update(record.id, updateFields, { typecast: config.enableTypecast });
            logger.debug('Record updated', { 
                recordId: record.id, 
                fields: Object.keys(updateFields) 
            });
        } catch (error) {
            logger.error('Failed to update record', error, {
                recordId: record.id,
                fields: Object.keys(updateFields)
            });
            throw new AirtableError('Failed to update record', {
                recordId: record.id,
                error: error.message
            });
        }
    }

    async takeSnapshot() {
        // TODO: Implement this
    }
}

// Create and export singleton instance
export const airtable = new AirtableService(); 