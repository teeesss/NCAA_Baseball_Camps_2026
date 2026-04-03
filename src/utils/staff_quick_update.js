/**
 * staff_quick_update.js
 * Tool to bulk-update Head Coaches and Camp POCs from a formatted string.
 * Usage: node src/utils/staff_quick_update.js "Arkansas | Dave Van Horn | Camp Coordinator | camp@uark.edu"
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');

const input = process.argv[2];

if (!input) {
    console.log('Usage: node src/utils/staff_quick_update.js "University | Head Coach | Camp POC | Email"');
    console.log('Example: node src/utils/staff_quick_update.js "SEC|Alabama|Coach X|POC Y|email@ua.edu"');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// Support both | and tab separators
const lines = input.split('\n');

lines.forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(/[|\t]/).map(s => s.trim());
    
    // Auto-detect number of parts. Minimum: University.
    let uni, coach, poc, email, url;
    
    if (parts.length >= 5) {
        [uni, coach, poc, email, url] = parts;
    } else if (parts.length === 4) {
        [uni, coach, poc, email] = parts;
    } else if (parts.length === 3) {
        [uni, coach, poc] = parts;
    } else if (parts.length === 2) {
        [uni, coach] = parts;
    } else {
        uni = parts[0];
    }

    const school = data.find(s => s.university.toLowerCase() === uni.toLowerCase());
    
    if (school) {
        if (coach && coach !== 'TBA') school.headCoach = coach;
        if (poc && poc !== 'TBA') school.campPOC = poc;
        if (email && email !== 'TBA') school.email = email;
        if (url && url !== 'TBA') school.campUrl = url;
        
        // Mark as Human Verified if we are manually providing this
        school.isVerified = true;
        school.isChecked = true;
        school.scriptVersion = 100; // Manual override version
        
        console.log(`✅ [${school.university}] Updated: Coach=${school.headCoach}, POC=${school.campPOC}, Email=${school.email}`);
    } else {
        console.warn(`🕒 [${uni}] NOT FOUND in database.`);
    }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('\nDone. Remember to run `npm run generate:html` then `npm run deploy`.');
