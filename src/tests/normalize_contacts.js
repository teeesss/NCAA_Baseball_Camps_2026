const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');

function migrate() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file not found:', DATA_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    let migratedCount = 0;

    data.forEach(school => {
        // 1. Initialize new fields if missing
        if (school.headCoach === undefined) school.headCoach = null;
        if (school.campPOC === undefined) school.campPOC = null;

        // 2. Logic to separate legacy 'contact' field
        // If contact has '|', it's likely "Name | email@edu"
        if (school.contact && school.contact.includes('|')) {
            const parts = school.contact.split('|').map(s => s.trim());
            const name = parts[0];
            const email = parts[1];

            // If we don't have headCoach yet, assume the name might be it
            if (!school.headCoach) school.headCoach = name;
            // The email goes to the email field if empty
            if (!school.email) school.email = email;
            
            migratedCount++;
        } else if (school.contact && !school.contact.includes('@')) {
            // It's just a name
            if (!school.headCoach) school.headCoach = school.contact;
            migratedCount++;
        } else if (school.contact && school.contact.includes('@')) {
            // It's just an email
            if (!school.email) school.email = school.contact;
            migratedCount++;
        }
    });

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Migrated ${data.length} records. High-level contact data normalized.`);
}

migrate();
