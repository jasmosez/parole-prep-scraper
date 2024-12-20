import { spawnSync } from 'child_process';
import { report } from './report.js';

/**
 * Custom error class representing an empty response from a cURL request.
 * 
 * @class CurlEmptyResponseError
 * @extends {Error}
 */
export class CurlEmptyResponseError extends Error {
    static ERROR_NAME = 'CurlEmptyResponseError';

    constructor(message) {
        super(message);
        this.name = CurlEmptyResponseError.ERROR_NAME;
    }
}

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - milliseconds to wait
 * @returns {Promise} resolves after delay
 */
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes a function with retry logic and exponential backoff
 * @param {Function} fn - function to execute
 * @param {Object} options - retry options
 * @returns {Promise} resolves with function result
 */
const withRetry = async (fn, options = {}) => {
    const {
        maxAttempts = 5,
        initialDelay = 5000,
        maxDelay = 60000,
        backoffFactor = 2
    } = options;

    let attempt = 1;
    let currentDelay = initialDelay;
    let totalStartTime = Date.now();

    while (attempt <= maxAttempts) {
        const attemptStartTime = Date.now();
        try {
            const result = await fn();
            // Track successful attempt after retries
            if (attempt > 1) {
                report.addNetworkMetric({
                    requestTime: Date.now() - totalStartTime,
                    success: true,
                    retryCount: attempt - 1
                });
            }
            return result;
        } catch (error) {
            if (error instanceof CurlEmptyResponseError) {
                // Track each failed attempt
                report.addNetworkMetric({
                    requestTime: Date.now() - attemptStartTime,
                    success: false,
                    errorType: error.name,
                    isEmpty: true,
                    retryAttempt: attempt,
                    backoffDelay: currentDelay
                });

                if (attempt === maxAttempts) throw error;
                
                console.log(`Attempt ${attempt} failed, retrying after ${currentDelay}ms...`);
                await delay(currentDelay);
                
                currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
                attempt++;
            } else {
                throw error;
            }
        }
    }
};

/**
 * Executes a curl command with the given options and returns the result.
 *
 * @param {string[]} options - An array of options to pass to the curl command.
 * @returns {Object|string} - The parsed JSON object if the output is valid JSON, otherwise the raw output string.
 */
const curlRequest = (options) => {
    const child = spawnSync('curl', options, { shell: true });
    const {error, stdout, stderr} = child;
    if(error){
        console.log('exec error: ' + error);
    }
    
    // Convert stdout buffer to string
    const stdoutString = stdout.toString();
    if (stdoutString === '') {
        const error = stderr.toString();
        const start = error.search('curl:')
        throw new CurlEmptyResponseError(`Empty response from server: ${error.slice(start).trim()}`);
    }

    // Try to parse the string as JSON
    try {
        return JSON.parse(stdoutString);
    } catch (e) {
        // If parsing fails, return the string
        return stdoutString;
    }
}  


/**
 * Fetches the schema of an Airtable base using the provided base ID and API key.
 *
 * @param {string} baseId - The ID of the Airtable base.
 * @param {string} apiKey - The API key for accessing the Airtable API.
 * @returns {Promise<Object>} The schema of the Airtable base.
 * @throws Will log an error to the console if the request fails.
 */
export const getAirtableBaseSchema = async (baseId, apiKey) => {
    const curlOptions = [`"https://api.airtable.com/v0/meta/bases/${baseId}/tables" \
        -H "Authorization: Bearer ${apiKey}"`]
    try {
        const schema = await withRetry(() => curlRequest(curlOptions))
        return schema;
    } catch(err) {
        console.log(err)
    }  
}


/**
 * Looks up information for a given DIN (Department Identification Number) using the NYS DOCCS lookup service.
 *
 * @param {string} din - The Department Identification Number to lookup.
 * @returns {Object} The response from the NYS DOCCS lookup service.
 * @throws Will throw an error if the request fails.
 */
export const lookupDIN = async (din) => {
    const curlOptions = [`'https://nysdoccslookup.doccs.ny.gov/IncarceratedPerson/SearchByDin' \
        -H 'Accept: */*' \
        -H 'Accept-Language: en-US,en;q=0.9' \
        -H 'Connection: keep-alive' \
        -H 'Sec-Fetch-Dest: empty' \
        -H 'Sec-Fetch-Mode: cors' \
        -H 'Sec-Fetch-Site: same-origin' \
        -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' \
        -H 'content-type: application/json; charset=utf-8' \
        --data-raw '"${din}"'`];

    const startTime = Date.now();
    try {
        const result = await withRetry(() => curlRequest(curlOptions));
        report.addNetworkMetric({ 
            requestTime: Date.now() - startTime,
            success: true,
            isEmpty: !result || Object.keys(result).length === 0
        });
        return result;
    } catch (error) {
        report.addNetworkMetric({ 
            requestTime: Date.now() - startTime,
            success: false,
            errorType: error.name,
            isEmpty: error instanceof CurlEmptyResponseError
        });
        return {
            error: error.name,
            userDisplayableMessage: error.message
        };
    }
};

/**
 * Validates a DIN (Department Identification Number).
 *
 * A valid DIN is a seven character string that consists of:
 * - Two digits
 * - One letter (uppercase or lowercase)
 * - Four digits
 *
 * @param {string} din - The DIN to validate.
 * @returns {boolean} True if the DIN is valid, false otherwise.
 */
export const validateDIN = (din) => {
    // Check if DIN is a seven character string with 2 numbers, a letter, and a 4 digit number
    return /^\d{2}[A-Za-z]\d{4}$/.test(din);
}
