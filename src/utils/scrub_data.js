/**
 * DATA INTEGRITY SCRUBBER
 * ============================================================
 * 1. Synchronizes 'dates' and 'details' fields.
 * 2. De-duplicates POC and Email.
 * 3. Initializes lastChecked and updateLog fields.
 * 4. Ensures authoritative source logic.
 * ============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');

function run() {
    console.log('\n🧹 DATA INTEGRITY SCRUBBER');
    console.log('=====================================\n');

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Master database not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const now = new Array(new Date().toISOString());
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    let conflictFixCount = 0;
    let contactFixCount = 0;
    let schemaInitCount = 0;

    data.forEach(record => {
        // 1. Initialize Schema Fields if missing
        if (!record.lastChecked) {
            record.lastChecked = new Date().toISOString();
            schemaInitCount++;
        }
        if (!record.updateLog) record.updateLog = [];
        if (!record.lastUpdateDate) record.lastUpdateDate = null;

        // 2. DISCREPANCY: Dates vs Details (The Arizona Fix)
        const hasDates = record.dates && record.dates !== 'TBA';
        const detailsHasNoDataMsg = record.details && record.details.toLowerCase().includes('no 2026 camps');

        if (hasDates && detailsHasNoDataMsg) {
            console.log(`[FIX] ${record.university}: Valid dates found (${record.dates}), purging stale "No 2026" message.`);
            record.details = ''; // Clear redundant negative news
            
            const logMsg = `${today}: Integrity Sync - Dates prioritized over stale details`;
            if (!record.updateLog.includes(logMsg)) {
                record.updateLog.unshift(logMsg);
                record.lastUpdateDate = new Date().toISOString();
            }
            conflictFixCount++;
        }

        // 3. CONTACT CLEANUP: POC vs Email
        if (record.email && record.campPOC) {
            const emailClean = record.email.toLowerCase().trim();
            const pocClean = record.campPOC.toLowerCase().trim();

            if (emailClean === pocClean) {
                // Duplicate entry - only keep Email, set POC to N/A or actual name if possible
                record.campPOC = null; 
                contactFixCount++;
            }
        }
        
        // Ensure N/A formatting for missing fields for UI logic
        if (record.campPOC === null) record.campPOC = 'N/A';
        if (record.email === null) record.email = 'N/A';
        if (!record.headCoach) record.headCoach = 'N/A';
    });

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    console.log(`\n✅ Conflicts Resolved:  ${conflictFixCount}`);
    console.log(`✅ Contact Duplicated: ${contactFixCount}`);
    console.log(`✅ Schema Fields Inited: ${schemaInitCount}`);
    console.log(`\n💾 Master source synchronized.\n`);
}

run();
