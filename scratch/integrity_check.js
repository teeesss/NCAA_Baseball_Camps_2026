const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const issues = {
    noDivision: data.filter(s => !s.division || s.division === 'N/A').map(s => s.university),
    noCampUrl: data.filter(s => !s.campUrl).map(s => s.university),
    duplicates: [],
    invalidEmails: []
};

// Check for duplicates
const uniNames = new Set();
data.forEach(s => {
    if (uniNames.has(s.university)) {
        issues.duplicates.push(s.university);
    }
    uniNames.add(s.university);
});

// Check for broken emails
data.forEach(s => {
    const emails = [s.email, s.campPOCEmail].filter(e => e && e !== 'N/A');
    emails.forEach(e => {
        if (!e.includes('@')) issues.invalidEmails.push({ uni: s.university, email: e });
    });
});

console.log('Database Integrity Report:');
console.log(`No Division: ${issues.noDivision.length}`);
console.log(`No CampUrl: ${issues.noCampUrl.length}`);
console.log(`Duplicates: ${issues.duplicates.length}`);
console.log(`Invalid Emails: ${issues.invalidEmails.length}`);

if (issues.noDivision.length > 0) console.log('No Division Examples:', issues.noDivision.slice(0, 5));
if (issues.duplicates.length > 0) console.log('Duplicate Examples:', issues.duplicates);
if (issues.invalidEmails.length > 0) console.log('Invalid Email Examples:', issues.invalidEmails.slice(0, 5));
