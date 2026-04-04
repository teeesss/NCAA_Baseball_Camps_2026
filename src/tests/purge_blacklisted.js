'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const { BLACKLISTED_DOMAINS } = require('../utils/config');

if (!fs.existsSync(DATA_FILE)) {
    console.error('Data file missing: ' + DATA_FILE);
    process.exit(1);
}

function purge() {
    console.log('🧹 Purging blacklisted domains from database...');
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const initialCount = data.length;

    const filtered = data.filter(item => {
        const url = (item.campUrl || '').toLowerCase();
        const isBlacklisted = BLACKLISTED_DOMAINS.some(d => url.includes(d.toLowerCase()));
        if (isBlacklisted) {
            console.log(`  🗑️ Removing: ${item.school} (${url})`);
        }
        return !isBlacklisted;
    });

    if (filtered.length !== initialCount) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
        console.log(`✅ Success: Removed ${initialCount - filtered.length} records.`);
    } else {
        console.log('✅ No blacklisted records found.');
    }
}

purge();
