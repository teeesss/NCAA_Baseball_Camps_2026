/**
 * Restoration Script: SEC & Notre Dame Integrity Fix
 * --------------------------------------------------
 * 1. Restores 'isVerified: true' for SEC schools based on historical verified_records.json.
 * 2. Properly tags all SEC programs in camps_data.json.
 * 3. Tagging Notre Dame as 'ACC'.
 * 4. Refactoring 'Independent / Other' to 'Other' across the entire DB.
 */

const fs = require('fs');
const path = require('path');
const { getConference } = require('./conference_lookup');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const VERIFIED_FILE = path.join(__dirname, '../../verified_records.json');

if (!fs.existsSync(DATA_FILE)) {
  console.error("Database not found.");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const verifiedRecords = fs.existsSync(VERIFIED_FILE) ? JSON.parse(fs.readFileSync(VERIFIED_FILE, 'utf8')) : [];

const secSchools = [
  'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU', 
  'Mississippi State', 'Missouri', 'Ole Miss', 'South Carolina', 'Tennessee', 
  'Texas A&M', 'Vanderbilt', 'Oklahoma', 'Texas'
];

let secRestored = 0;
let ndFixed = false;
let otherRenamed = 0;

data.forEach(school => {
  // 1. Rename Independent / Other -> Other
  if (school.conference === 'Independent / Other' || !school.conference) {
    school.conference = 'Other';
    otherRenamed++;
  }

  // 2. Apply SEC Tags and Restore Verification
  if (secSchools.includes(school.university)) {
    school.conference = 'SEC';
    
    // Check if it was manually verified in verified_records.json
    const wasVerified = verifiedRecords.find(v => v.university === school.university);
    if (wasVerified) {
      school.isVerified = true;
      // Also restore the URL/Contact if they were lost/overwritten by a failed script run
      if (!school.campUrl || school.campUrl.includes('google.com')) {
          school.campUrl = wasVerified.url;
      }
      if (!school.contact) {
          school.contact = wasVerified.coach;
      }
      secRestored++;
    }
  }

  // 3. Notre Dame -> ACC
  if (school.university === 'Notre Dame') {
    school.conference = 'ACC';
    ndFixed = true;
  }

  // 4. General Conference Audit (using lookup)
  const lookupConf = getConference(school.university);
  if (lookupConf !== 'Other') {
    school.conference = lookupConf;
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log(`--- Restoration Complete ---`);
console.log(`✅ SEC Teams Verified/Tagged: ${secRestored}`);
console.log(`✅ Notre Dame -> ACC: ${ndFixed ? 'Yes' : 'No'}`);
console.log(`✅ 'Other' naming applied: ${otherRenamed} total defaults`);
console.log(`----------------------------`);
