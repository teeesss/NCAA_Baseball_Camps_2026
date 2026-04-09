const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const institutionalDomains = {
    'alasu.edu': 'Alabama State',
    'uark.edu': 'Arkansas',
    'ua.edu': 'Alabama',
    'utexas.edu': 'Texas',
    'tamu.edu': 'Texas A&M',
    'okstate.edu': 'Oklahoma State',
    'ou.edu': 'Oklahoma',
    'osu.edu': 'Ohio State',
    'fsu.edu': 'Florida State',
    'ufl.edu': 'Florida',
    'lsu.edu': 'LSU',
    'auburn.edu': 'Auburn'
};

let fixes = 0;

data.forEach(school => {
    const uniLower = school.university.toLowerCase();
    
    ['email', 'campPOCEmail'].forEach(field => {
        const val = school[field];
        if (val && val !== 'N/A') {
            const domain = val.split('@').pop().toLowerCase();
            const expectedUni = institutionalDomains[domain];
            
            if (expectedUni && !uniLower.includes(expectedUni.toLowerCase())) {
                // Potential mismatch!
                // Exceptions: "Texas" in "Texas A&M" is ok if domain is utexas.edu? No, TAMU is tamu.edu.
                console.log(`Fixing ${school.university}: removing ${val} (belongs to ${expectedUni})`);
                school[field] = 'N/A';
                fixes++;
            }
        }
    });

    if (school.contact && school.contact.includes('@')) {
        const emailMatch = school.contact.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
        if (emailMatch) {
            const email = emailMatch[0];
            const domain = email.split('@').pop().toLowerCase();
            const expectedUni = institutionalDomains[domain];
            if (expectedUni && !uniLower.includes(expectedUni.toLowerCase())) {
                console.log(`Fixing ${school.university} contact: removing ${email} (belongs to ${expectedUni})`);
                school.contact = school.contact.replace(email, '').replace('|', '').trim() || 'N/A';
                fixes++;
            }
        }
    }
});

if (fixes > 0) {
    fs.writeFileSync('camps_data.json', JSON.stringify(data, null, 2));
    console.log(`Scrubbed ${fixes} institutional domain mismatches.`);
} else {
    console.log('No institutional domain mismatches found.');
}
