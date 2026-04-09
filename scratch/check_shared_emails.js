const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const emailMap = new Map();

data.forEach(s => {
    const emails = [s.email, s.campPOCEmail].filter(e => e && e !== 'N/A' && !e.includes('ryzer.com') && !e.includes('totalcamps.com'));
    emails.forEach(e => {
        const lower = e.toLowerCase();
        if (!emailMap.has(lower)) {
            emailMap.set(lower, []);
        }
        emailMap.get(lower).push(s.university);
    });
});

const shared = [];
for (const [email, unis] of emailMap.entries()) {
    if (unis.length > 1) {
        shared.push({ email, unis });
    }
}

console.log(`Found ${shared.length} shared emails.`);
console.log(JSON.stringify(shared.slice(0, 10), null, 2));
