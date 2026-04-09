const fs = require('fs');
const path = require('path');
const { BLACKLISTED_EMAIL_DOMAINS } = require('../src/utils/config');

const DATA_FILE = 'camps_data.json';
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

let purgedCount = 0;
const affectedSchools = [];

data.forEach(s => {
    let changed = false;
    
    // Check campPOCEmail
    if (s.campPOCEmail) {
        if (BLACKLISTED_EMAIL_DOMAINS.some(d => s.campPOCEmail.toLowerCase().includes(d))) {
            console.log(`[Purge] Found bad POC email in ${s.university}: ${s.campPOCEmail}`);
            s.campPOCEmail = "";
            changed = true;
        }
    }
    
    // Check old email field just in case
    if (s.email) {
        if (BLACKLISTED_EMAIL_DOMAINS.some(d => s.email.toLowerCase().includes(d))) {
            console.log(`[Purge] Found bad legacy email in ${s.university}: ${s.email}`);
            s.email = "";
            changed = true;
        }
    }

    if (changed) {
        s.isChecked = false; // Re-queue for extraction with the new blacklist
        s.auditStatus = "BAD_EMAIL_PURGED";
        purgedCount++;
        affectedSchools.push(s.university);
    }
});

if (purgedCount > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\n✅ Successfully purged bad emails from ${purgedCount} schools.`);
    console.log(`Re-queued: ${affectedSchools.join(', ')}`);
} else {
    console.log("No bad emails found matching the blacklist.");
}
