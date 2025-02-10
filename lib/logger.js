const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};

/**
 * Logger class for consistent logging across the application
 * Provides methods for different log levels and metadata
 */
class Logger {
    constructor(prefix = 'DOCCS-Sync') {
        this.prefix = prefix;
    }

    formatMessage(level, message, metadata = {}) {
        const timestamp = new Date().toLocaleTimeString();
        const metadataStr = Object.keys(metadata).length 
            ? ` ${JSON.stringify(metadata)}`
            : '';
        return `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}${metadataStr}`;
    }

    /**
     * Logs a debug message, which is only visible if the `DEBUG` flag is set to `true`
     */
    debug(message, metadata = {}) {
        if (config.debug) {
            console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, metadata));
        }
    }

    info(message, metadata = {}) {
        console.log(this.formatMessage(LOG_LEVELS.INFO, message, metadata));
    }

    warn(message, metadata = {}) {
        console.warn(this.formatMessage(LOG_LEVELS.WARN, message, metadata));
    }

    error(message, error, metadata = {}) {
        console.error(this.formatMessage(
            LOG_LEVELS.ERROR,
            message, 
            { ...metadata, error: error?.message || error }
        ));
    }

    // Specific helpers for our use cases
    logProgress(current, total, din) {
        this.info(`Processing DIN`, { 
            progress: `${current}/${total}`,
            din 
        });
    }

    logBatch(batchIndex, startIndex, batchSize) {
        this.info(`Processing batch`, { 
            batchIndex,
            startIndex,
            batchSize
        });
    }

    logBatchComplete(batchIndex, processingTime) {
        this.info(`Batch complete`, {
            batchIndex,
            processingTimeSeconds: processingTime.toFixed(2)
        });
    }

    // TODO: consider making this a debug message once we deploy to prod
    logReport(report, isFinal = false) {
        this.info(isFinal ? 'Final report' : 'Batch report');
        console.dir(report.getSummary(), { depth: null });
    }
}

export const logger = new Logger();