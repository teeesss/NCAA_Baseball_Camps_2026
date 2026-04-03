const fs = require('fs');
const path = 'camps_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const targets = ['Truman State University', 'Washington', 'Western Carolina', 'Wichita State', 'William & Mary', 'Winthrop'];

let count = 0;
data.forEach(school => {
    if (targets.includes(school.university)) {
        school.isChecked = false;
        school.scriptVersion = 0; // Reset to force V6 processing
        school.campTiers = [];
        school.dates = "TBA";
        school.details = "*Note: No 2026 camps posted as of April 2026.*";
        count++;
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log(`Reset ${count} schools for V6 re-processing.`);
