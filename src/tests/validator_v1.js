/**
 * DATA INTEGRITY VALIDATOR V1
 * Iterates through the entire database and verifies that:
 * 1. Camp URLs are still active (200 OK).
 * 2. URLs haven't been hijacked by generic search portals.
 * 3. School names are still present on the target page.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getUniversityAliases } = require('./mascot_lookup');

const DATA_FILE = path.join(__dirname, 'camps_data.json');
const LOG_FILE  = path.join(__dirname, 'validation_v1.log');

let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

function log(msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

async function validate() {
    log(`Starting validation of ${data.length} records...`);
    let broken = 0;
    let verified = 0;

    for (let i = 0; i < data.length; i++) {
        const camp = data[i];
        if (!camp.campUrl || !camp.campUrl.startsWith('http')) continue;

        try {
            const resp = await axios.get(camp.campUrl, { 
                timeout: 8000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                validateStatus: false 
            });

            if (resp.status >= 400) {
                log(`[BROKEN] ${camp.university} - HTTP ${resp.status} - ${camp.campUrl}`);
                camp.isBroken = true;
                camp.isChecked = false; // Force re-scan
                broken++;
            } else {
                // Content check
                const body = (resp.data || '').toLowerCase();
                const aliases = getUniversityAliases(camp.university);
                const hasAlias = aliases.some(a => body.includes(a.toLowerCase()));

                if (!hasAlias && !camp.isVerified) {
                    log(`[SUSPECT] ${camp.university} - School name not found on page. Possible hijack.`);
                    camp.isBroken = true;
                    camp.isChecked = false;
                    broken++;
                } else {
                    verified++;
                    camp.isBroken = false;
                    camp.lastValidated = new Date().toISOString();
                }
            }
        } catch (e) {
            log(`[ERROR] ${camp.university} - ${e.message}`);
            camp.isBroken = true;
            camp.isChecked = false;
            broken++;
        }

        // Save progress every 20 schools
        if (i % 20 === 0) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    log(`Validation complete. Verified: ${verified} | Broken: ${broken}`);
}

validate();
