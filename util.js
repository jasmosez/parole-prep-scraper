import { spawnSync } from 'child_process';

/**
 * Executes a curl command with the given options and returns the result.
 * If the result is a valid JSON string, it will be parsed and returned as an object.
 * Otherwise, the raw string output will be returned.
 *
 * @param {string[]} options - The options to pass to the curl command.
 * @returns {Promise<Object|string>} - A promise that resolves to the parsed JSON object or the raw string output.
 */
const curlRequest = async (options) => {
    const child = spawnSync('curl', options, { shell: true });
    const {error, stdout} = child;
    if(error){
        console.log('exec error: ' + error);
    }
    
    // Convert stdout buffer to string
    const stdoutString = stdout.toString();

    // Try to parse the string as JSON
    try {
        const jsonObject = JSON.parse(stdoutString);
        return jsonObject;
    } catch (e) {
        // If parsing fails, return the string
        return stdoutString;
    }
}  

/**
 * Fetches information about an incarcerated person using their DIN (Department Identification Number) from the New York State Department of Corrections and Community Supervision (NYC DOCCS).
 *
 * @param {string} din - The Department Identification Number of the incarcerated person.
 * @returns {Promise<void>} A promise that resolves when the data has been fetched and logged.
 * @throws Will throw an error if the request fails.
 */
export const lookupDIN = async (din) => {
    const curlOptions = [`curl 'https://nysdoccslookup.doccs.ny.gov/IncarceratedPerson/SearchByDin' \
        -H 'Accept: */*' \
        -H 'Accept-Language: en-US,en;q=0.9' \
        -H 'Connection: keep-alive' \
        -H 'Sec-Fetch-Dest: empty' \
        -H 'Sec-Fetch-Mode: cors' \
        -H 'Sec-Fetch-Site: same-origin' \
        -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' \
        -H 'content-type: application/json; charset=utf-8' \
        --data-raw '"${din}"'`]

    try{
        return await curlRequest(curlOptions)
    } catch(err){
        console.log(err)
    }
}