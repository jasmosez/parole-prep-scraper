import { logger } from './logger.js';

// Define outcome types as an enum-like object for better type safety
export const RecordOutcome = {
    INVALID_DIN: 'INVALID_DIN',
    ERROR_RESPONSE: 'ERROR_RESPONSE',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    NO_CHANGE: 'NO_CHANGE',
    CHANGED: 'CHANGED',
    UPDATE_FAILED: 'UPDATE_FAILED'
};

// Define the Report class first
class Report {
    constructor() {
        this.records = {};
        this.summary = {
            total: 0,
            byOutcome: {},
            byFieldChange: {},
            processingTime: {
                totalSeconds: 0,
                batchCount: 0,
                averageSeconds: 0,
                byBatch: []
            },
            networkMetrics: {
                totalRequests: 0,
                failedRequests: 0,
                emptyResponses: 0,
                averageRequestTime: 0,
                totalRequestTime: 0,
                requestTimes: [],
                errorsByType: {},
                consecutiveFailures: {
                    current: 0,
                    max: 0
                }
            }
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
        const { networkMetrics, processingTime, ...rest } = this.summary;
        const { byBatch, ...otherProcessingTime } = processingTime;
        const { requestTimes, ...otherNetworkMetrics } = networkMetrics;
        return {
            ...rest,
            processingTime: otherProcessingTime,
            networkMetrics: otherNetworkMetrics,
        };
    }

    addBatchTime(batchIndex, startTime, endTime) {
        const processingSeconds = (endTime - startTime) / 1000;
        
        this.summary.processingTime.totalSeconds += processingSeconds;
        this.summary.processingTime.batchCount++;
        this.summary.processingTime.averageSeconds = 
            this.summary.processingTime.totalSeconds / this.summary.processingTime.batchCount;
        
        this.summary.processingTime.byBatch.push({
            batchIndex,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            processingSeconds
        });
    }

    addNetworkMetric({ 
        requestTime, 
        success = true, 
        errorType = null, 
        isEmpty = false,
        retryAttempt = 0,
        retryCount = 0,
        backoffDelay = 0
    }) {
        const metrics = this.summary.networkMetrics;
        
        metrics.totalRequests++;
        metrics.totalRequestTime += requestTime;
        metrics.averageRequestTime = metrics.totalRequestTime / metrics.totalRequests;
        
        // Track retries
        if (retryAttempt > 0) {
            metrics.retryAttempts = (metrics.retryAttempts || 0) + 1;
            metrics.totalBackoffTime = (metrics.totalBackoffTime || 0) + backoffDelay;
        }
        
        metrics.requestTimes.push({
            timestamp: new Date().toISOString(),
            duration: requestTime,
            success,
            errorType,
            isEmpty,
            retryAttempt,
            backoffDelay
        });

        if (!success) {
            metrics.failedRequests++;
            metrics.consecutiveFailures.current++;
            metrics.consecutiveFailures.max = Math.max(
                metrics.consecutiveFailures.max, 
                metrics.consecutiveFailures.current
            );
            if (errorType) {
                metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
            }
        } else {
            if (retryCount > 0) {
                metrics.successfulRetries = (metrics.successfulRetries || 0) + 1;
            }
            metrics.consecutiveFailures.current = 0;
        }

        if (isEmpty) {
            metrics.emptyResponses++;
        }
    }

    getNetworkAnalysis() {
        const metrics = this.summary.networkMetrics;
        return {
            ...metrics,
            failureRate: metrics.failedRequests / metrics.totalRequests,
            emptyResponseRate: metrics.emptyResponses / metrics.totalRequests,
            requestTimePercentiles: this.calculatePercentiles(metrics.requestTimes.map(r => r.duration)),
            recommendations: this.generateRecommendations()
        };
    }

    calculatePercentiles(times) {
        const sorted = [...times].sort((a, b) => a - b);
        return {
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p75: sorted[Math.floor(sorted.length * 0.75)],
            p90: sorted[Math.floor(sorted.length * 0.9)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }

    generateRecommendations() {
        const m = this.summary.networkMetrics;
        const recommendations = [];

        if (m.emptyResponses / m.totalRequests > 0.05) {
            recommendations.push('High rate of empty responses - consider increasing delay between requests');
        }
        if (m.consecutiveFailures.max > 3) {
            recommendations.push('Consider implementing exponential backoff due to consecutive failures');
        }
        if (m.averageRequestTime > 2000) {
            recommendations.push('High average request time detected - may need to reduce concurrent requests');
        }

        return recommendations;
    }

    getTextReport() {
        const timestamp = new Date().toLocaleString('en-US', {
            year: 'numeric', 
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        const summary = this.getSummary();
        let report = [];

        // Header
        report.push('DOCCS SYNC SCRIPT REPORT');
        report.push(timestamp);
        report.push('');

        // Summary section
        report.push('SUMMARY');
        report.push(`- Total Records: ${summary.total}`);
        report.push('- By Outcome:');
        Object.entries(summary.byOutcome).forEach(([outcome, count]) => {
            report.push(`    - ${outcome}: ${count}`);
        });

        // Field changes summary
        if (Object.keys(summary.byFieldChange).length > 0) {
            report.push('- By Field Change:');
            Object.entries(summary.byFieldChange).forEach(([field, count]) => {
                report.push(`    - ${field}: ${count}`);
            });
        }
        report.push('');

        // Changed records detail section
        const changedRecords = this.getRecordsByOutcome(RecordOutcome.CHANGED);
        if (changedRecords.length > 0) {
            report.push('CHANGED');
            
            // Group changes by field
            const changesByField = {};
            changedRecords.forEach(record => {
                record.changes.forEach(change => {
                    if (!changesByField[change.field]) {
                        changesByField[change.field] = [];
                    }
                    changesByField[change.field].push({
                        din: record.din,
                        newValue: change.newValue,
                        oldValue: change.oldValue,
                    });
                });
            });

            // Output each field's changes
            Object.entries(changesByField).forEach(([field, changes]) => {
                report.push(`Field: ${field}`);
                changes.forEach(change => {
                    report.push(`- ${change.din}: ${change.newValue}, previously ${change.oldValue}`);
                });
                report.push('');
            });
        }

        // Other outcome sections
        const outcomeTypes = Object.values(RecordOutcome).filter(type => type !== RecordOutcome.CHANGED);
        outcomeTypes.forEach(outcome => {
            const records = this.getRecordsByOutcome(outcome);
            if (records.length > 0) {
                report.push(outcome);
                report.push(records.map(r => r.din).join(', '));
                report.push('');
            }
        });

        return report.join('\n');
    }
}

// Then create and export the factory function
export const createReport = () => new Report();

// Finally create and export the singleton instance
export const report = createReport(); 