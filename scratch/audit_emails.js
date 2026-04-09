const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const commonNames = ['alabama', 'arkansas', 'auburn', 'baylor', 'clemson', 'duke', 'florida', 'georgia', 'kentucky', 'lsu', 'miami', 'michigan', 'missouri', 'north carolina', 'ohio state', 'oklahoma', 'oregon', 'penn state', 'south carolina', 'stanford', 'tennessee', 'texas', 'ucla', 'usc', 'vanderbilt', 'virginia', 'wisconsin'];

const suspicious = [];

data.forEach(school => {
    const emails = [];
    if (school.email && school.email !== 'N/A') emails.push(school.email);
    if (school.campPOCEmail && school.campPOCEmail !== 'N/A') emails.push(school.campPOCEmail);
    if (school.contact && school.contact.includes('@')) {
        const match = school.contact.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
        if (match) emails.push(match[0]);
    }

    emails.forEach(email => {
        const emailLower = email.toLowerCase();
        commonNames.forEach(name => {
            if (emailLower.includes(name) && !school.university.toLowerCase().includes(name)) {
                // Potential contamination! 
                // Exceptions: if the school name is an alias (e.g. "UT" vs "Texas")
                suspicious.push({
                    uni: school.university,
                    email: email,
                    foundName: name
                });
            }
        });
    });
});

console.log(`Found ${suspicious.length} suspicious emails.`);
console.log(JSON.stringify(suspicious.slice(0, 20), null, 2));
