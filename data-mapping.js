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

const getISOfromDOCCSDateString = (doccs) => {
    // Handle empty/invalid values
    if (!doccs) return '';
    
    // Parse date string using regex to handle both formats
    const dateMatch = doccs.match(/^(\d{2})[/-](?:(\d{2})[/-])?(\d{4})$/);
    if (!dateMatch) return '';
    
    const [, month, day, year] = dateMatch;
    // If no day provided (MM/YYYY format), use first of month
    const dayValue = day || '01';
    
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
        id: 'fldBgfrJtoRM2NY9s', //'Housing / Releasing Facility'
        type: 'multipleSelects',
        test: (air, doccs) => air?.includes(toTitleCase(doccs)),
        update: (doccs) => [toTitleCase(doccs)]
    },
    'paroleHearingDate': {
        id: 'fldptoJdU40n5dlO7', //Next Interview Date [DOCCS]
        type: 'date',
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs)
    },   
    'releaseDate': {
        id: 'flduQFFHqzBME4Ml1', //Latest Release Date / Type (Released People Only) [DOCCS]
        type: 'date',
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs)
    },
    'sentence': {
        id: 'fldAx3FzIpIkZrmLA', // 'Sentence'
        type: 'text',
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
        requiredFields: ['minSentence', 'maxSentence']
    },
    'county': {
        id: 'fldOc0FgeFDZhxj8n', //'County'
        type: 'text',
        test: (air, doccs) => air === toTitleCase(doccs),
        update: (doccs) => toTitleCase(doccs)
    },
    'race': {
        id: 'fldMbteGxI06RGghM', //'Race'
        type: 'text',
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'paroleHearingType': {
        id: 'fld1W4lMm0iLcV9ui', //'Parole Interview Type'
        type: 'text',
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'paroleEligDate': {
        id: 'fldQ6fmoi52aTsQmw', //'Parole Eligibility Date'
        type: 'date',
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs)
    },
    'earliestReleaseDate': {
        id: 'fldzGsyKz7ZNV9S7A', //'Earliest Release Date'
        type: 'date',
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs)
    },
    'dateOfBirth': {
        id: 'fldmVco0UMW7hxj4I', //'Date of Birth'
        type: 'date',
        test: (air, doccs) => air === getISOfromDOCCSDateString(doccs),
        update: (doccs) => getISOfromDOCCSDateString(doccs)
    },
}