import { config } from './config.js';

// Helper functions
export const toTitleCase = (str) => {
    return str.split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

export const convertToDecimalYears = (sentence) => {
    if (!sentence) return '';
    
    // Expected format: "x years, y months, z days" or variations
    const parts = sentence.toLowerCase().match(/(\d+)\s*years?|(\d+)\s*months?|(\d+)\s*days?/g);
    if (!parts) return sentence.trim(); // Return original string if we can't parse it

    let years = 0;
    parts.forEach(part => {
        if (part.includes('year')) {
            years += parseInt(part);
        } else if (part.includes('month')) {
            years += parseInt(part) / 12;
        } else if (part.includes('day')) {
            years += parseInt(part) / 365;
        }
    });
    return Number(years.toFixed(2));
};

/**
 * Converts a DOCCS date string to ISO format (YYYY-MM-DD)
 * @param {string} doccs - Date string in one of these formats: MM/DD/YYYY, MM/YYYY, MM/DD/YY
 * @returns {string} Date in ISO format YYYY-MM-DD, or empty string if invalid
 */
const getISOfromDOCCSDateString = (doccs) => {
    // Handle empty/invalid values
    if (!doccs) return '';
    
    // Parse date string using regex to handle all formats (MM/DD/YYYY, MM/YYYY, and MM/DD/YY)
    const dateMatch = doccs.match(/^(\d{2})[/-](?:(\d{2})[/-])?(\d{2,4})$/);
    if (!dateMatch) return '';
    
    const [, month, day, yearPart] = dateMatch;
    // If no day provided (MM/YYYY format), use first of month
    const dayValue = day || '01';
    
    // Convert 2-digit year to 4-digit year (assuming 20YY for now, as we're dealing with recent dates)
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    
    // Validate month/day/year
    const date = new Date(`${year}-${month}-${dayValue}`);
    if (isNaN(date.getTime())) return '';
    
    // Return in ISO format YYYY-MM-DD
    return date.toISOString().split('T')[0];
}

// Map DOCCS data to Airtable fields
export const DIN = 'DIN';

export const DOCCS_TO_AIR = {
    'facility': {
        ...config.airtable.fieldMappings['facility'],
        test: (air, doccs) => air?.includes(toTitleCase(doccs)),
        update: (doccs) => [toTitleCase(doccs)],
        causeAlert: false
    },
    'paroleHearingDate': {
        ...config.airtable.fieldMappings['paroleHearingDate'],
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs),
        causeAlert: true
    },   
    'latestRelDate': {
        ...config.airtable.fieldMappings['latestRelDate'],
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs),
        causeAlert: true
    },
    'sentence': {
        ...config.airtable.fieldMappings['sentence'],
        test: (air, doccs) => {
            const { minSentence, maxSentence } = doccs;
            const minValue = convertToDecimalYears(minSentence);
            const maxValue = convertToDecimalYears(maxSentence);
            const expectedFormat = `${minValue} - ${maxValue}`;
            return air === expectedFormat;
        },
        update: (doccs) => {
            const { minSentence, maxSentence } = doccs;
            const minValue = convertToDecimalYears(minSentence);
            const maxValue = convertToDecimalYears(maxSentence);
            return `${minValue} - ${maxValue}`;
        },
        requiredFields: ['minSentence', 'maxSentence'],
        causeAlert: false
    },
    'county': {
        ...config.airtable.fieldMappings['county'],
        test: (air, doccs) => air === toTitleCase(doccs),
        update: (doccs) => toTitleCase(doccs),
        causeAlert: false
    },
    'race': {
            ...config.airtable.fieldMappings['race'],
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs,
        causeAlert: false
    },
    'paroleHearingType': {
        ...config.airtable.fieldMappings['paroleHearingType'],
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs,
        causeAlert: false
    },
    'paroleEligDate': {
        ...config.airtable.fieldMappings['paroleEligDate'],
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs),
        causeAlert: false
    },
    'earliestReleaseDate': {
        ...config.airtable.fieldMappings['earliestReleaseDate'],
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs),
        causeAlert: false
    },
    'earliestReleaseType': {
        ...config.airtable.fieldMappings['earliestReleaseType'],
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs,
        causeAlert: true
    },
    'dateOfBirth': {
        ...config.airtable.fieldMappings['dateOfBirth'],
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs),
        causeAlert: false
    },
};