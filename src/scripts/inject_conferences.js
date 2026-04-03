const fs = require('fs');
const path = require('path');
const { CONFERENCE_LOOKUP } = require('../utils/conference_lookup');

const DATA_PATH = path.join(__dirname, '../../camps_data.json');

function runInjection() {
    console.log('🚀 Starting Data Enrichment & High-Fidelity Scrub...');
    
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ camps_data.json not found at', DATA_PATH);
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    let updatedCount = 0;
    let scrubCount = 0;

    data.forEach(school => {
        // 1. Conference Injection
        const foundConf = CONFERENCE_LOOKUP[school.university];
        if (foundConf) {
            school.conference = foundConf;
            updatedCount++;
        } else {
            school.conference = school.conference || 'Independent / Other';
        }

        // 2. High-Fidelity Email Scrub (Triple-Gator Fix)
        // If the email belongs to Florida Gators but the school is NOT Florida, Florida State (ACC), etc.
        // Actually, strictly: if email contains ufl.edu and school isn't "Florida", it's wrong.
        const isGatorEmail = school.email && (school.email.toLowerCase().includes('ufl.edu') || school.email.toLowerCase().includes('gators'));
        const isFlorida = school.university === 'Florida';
        
        if (isGatorEmail && !isFlorida) {
            console.log(`  🛡️  Scrubbing contaminated Gator email from [${school.university}]: ${school.email}`);
            school.email = ""; // Kill the bad email
            scrubCount++;
        }

        // 3. Details Cleanup
        if (school.details && school.details.includes('Scrubbed due to invalid data')) {
            // Keep it if it really has no data, but if it has a campUrl now, clear the warning
            if (school.campUrl && school.campUrl !== "") {
                school.details = school.details.replace('(Scrubbed due to invalid data; queueing for re-extraction)', '').trim();
            }
        }
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    console.log(`✅ Enrichment Complete!`);
    console.log(`   - Conferences Injected: ${updatedCount}`);
    console.log(`   - Contaminated Emails Scrubbed: ${scrubCount}`);
    console.log(`   - Master Database Updated: ${DATA_PATH}`);
}

runInjection();
