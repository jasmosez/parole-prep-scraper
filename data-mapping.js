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

// Map DOCCS data to Airtable fields
export const DIN = 'DIN';

export const DOCCS_TO_AIR = {
    'facility': {
        id: 'fldBgfrJtoRM2NY9s', //'Housing / Releasing Facility'
        test: (air, doccs) => air?.includes(toTitleCase(doccs)),
        update: (doccs) => [toTitleCase(doccs)]

    },
    'paroleHearingDate': {
        id: 'fldptoJdU40n5dlO7', //Next Interview Date [DOCCS]
        test: (air, doccs) => air === new Date(doccs.slice(0,3) + '01/' + doccs.slice(3)).toISOString().split('T')[0],
        update: (doccs) => new Date(doccs.slice(0,3) + '01/' + doccs.slice(3)).toISOString().split('T')[0]
    },   
    'releaseDate': {
        id: 'flduQFFHqzBME4Ml1', //Latest Release Date / Type (Released People Only) [DOCCS]
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'sentence': {
        id: 'fldAx3FzIpIkZrmLA', // 'Sentence'
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
        test: (air, doccs) => air === toTitleCase(doccs),
        update: (doccs) => toTitleCase(doccs)
    },
    // 'race': {
    //     id: '', //'Race'
    //     test: (air, doccs) => air === doccs,
    //     update: (doccs) => doccs
    // },
    'paroleHearingType': {
        id: 'fld1W4lMm0iLcV9ui', //'Parole Interview Type'
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    // 'paroleEligDate': {
    //     id: '', //'Parole Eligibility Date'
    //     test: (air, doccs) => air === doccs,
    //     update: (doccs) => doccs
    // },
    'earliestReleaseDate': {
        id: 'fldzGsyKz7ZNV9S7A', //'Earliest Release Date'
        test: (air, doccs) => air === doccs,
        update: (doccs) => doccs
    },
    'dateOfBirth': {
        id: 'fldmVco0UMW7hxj4I', //'Date of Birth'
        test: (air, doccs) => air === new Date(doccs).toISOString().split('T')[0],
        update: (doccs) => new Date(doccs).toISOString().split('T')[0]
    },
}
