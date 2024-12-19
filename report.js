// Define outcome types as an enum-like object for better type safety
export const RecordOutcome = {
    INVALID_DIN: 'INVALID_DIN',
    ERROR_RESPONSE: 'ERROR_RESPONSE',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
    NO_CHANGE: 'NO_CHANGE',
    CHANGED: 'CHANGED',
    UPDATE_FAILED: 'UPDATE_FAILED'
};

class Report {
    constructor() {
        this.records = {};
        this.summary = {
            total: 0,
            byOutcome: {},
            byFieldChange: {}
        };
    }

    addRecord({recordId, din, outcome, message = '', changes = []}) {
        if (!Object.values(RecordOutcome).includes(outcome)) {
            throw new Error(`Invalid outcome: ${outcome}`);
        }

        // Initialize record entry
        this.records[recordId] = {
            din,
            outcome,
            message,
            changes,
            timestamp: new Date().toISOString()
        };

        // Update summary counts
        this.summary.total++;
        this.summary.byOutcome[outcome] = (this.summary.byOutcome[outcome] || 0) + 1;
        
        // Track field-level changes
        if (outcome === RecordOutcome.CHANGED) {
            changes.forEach(({field}) => {
                if (!this.summary.byFieldChange[field]) {
                    this.summary.byFieldChange[field] = 0;
                }
                this.summary.byFieldChange[field]++;
            });
        }

        console.log(`Added to report: ${outcome} ${recordId} ${din} ${message}`);
    }

    getRecordsByOutcome(outcome) {
        return Object.values(this.records).filter(r => r.outcome === outcome);
    }

    getRecordsByFieldChange(fieldName) {
        return Object.values(this.records).filter(r => 
            r.changes?.some(change => change.field === fieldName)
        );
    }

    getSummary() {
        return this.summary;
    }
}

export const createReport = () => new Report(); 