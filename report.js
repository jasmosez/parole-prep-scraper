// Define outcome types as an enum-like object for better type safety
export const RecordOutcome = {
    INVALID_DIN: 'INVALID_DIN',
    ERROR_RESPONSE: 'ERROR_RESPONSE',
    EMPTY_RESPONSE: 'EMPTY_RESPONSE',
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

        console.log(`Batch ${batchIndex} processing time: ${processingSeconds.toFixed(2)}s`);
        console.log(`Average processing time: ${this.summary.processingTime.averageSeconds.toFixed(2)}s`);
    }

    addNetworkMetric({ 
        requestTime, 
        success = true, 
        errorType = null, 
        isEmpty = false 
    }) {
        const metrics = this.summary.networkMetrics;
        
        // Track request counts and times
        metrics.totalRequests++;
        metrics.totalRequestTime += requestTime;
        metrics.averageRequestTime = metrics.totalRequestTime / metrics.totalRequests;
        metrics.requestTimes.push({
            timestamp: new Date().toISOString(),
            duration: requestTime,
            success,
            errorType,
            isEmpty
        });

        // Track failures and types
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
            metrics.consecutiveFailures.current = 0;
        }

        // Track empty responses
        if (isEmpty) {
            metrics.emptyResponses++;
        }

        // Log significant events
        // if (!success) {
        //     console.log(`Network event: ${errorType} - Request time: ${requestTime}ms${isEmpty ? ' (Empty response)' : ''}`);
        //     if (metrics.consecutiveFailures.current > 2) {
        //         console.log(`Warning: ${metrics.consecutiveFailures.current} consecutive failures`);
        //     }
        // }
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
}

// Then create and export the factory function
export const createReport = () => new Report();

// Finally create and export the singleton instance
export const report = createReport(); 