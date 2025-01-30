export class CurlEmptyResponseError extends Error {
    static ERROR_NAME = 'CurlEmptyResponseError';

    constructor(message) {
        super(message);
        this.name = CurlEmptyResponseError.ERROR_NAME;
    }
}

export class CurlNetworkError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'CurlNetworkError';
        this.code = code;
    }
}

export class CurlTimeoutError extends CurlNetworkError {
    constructor(message) {
        super(message, 'ETIMEDOUT');
        this.name = 'CurlTimeoutError';
    }
}

export class AirtableError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'AirtableError';
        this.details = details;
    }
}

export class SchemaValidationError extends AirtableError {
    constructor(message, details = {}) {
        super(message, details);
        this.name = 'SchemaValidationError';
    }
}

export class DataTypeError extends AirtableError {
    constructor(message, details = {}) {
        super(message, details);
        this.name = 'DataTypeError';
    }
}

export class FieldMappingError extends AirtableError {
    constructor(message, details = {}) {
        super(message, details);
        this.name = 'FieldMappingError';
    }
} 