/**
 * purge_arizona.js
 * Cleans up the contaminated Arizona record.
 */

const fs = require('fs');
const DATA_FILE = 'camps_data.json';

function run() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const school = data.find(d => d.university === 'Arizona');
  
  if (school) {
    console.log(`🧹 Purging contaminated data for ${school.university}...`);
    school.campTiers = [];
    school.dates = "TBA";
    school.cost = "TBA";
    school.isChecked = false; // Re-process it
    school.scriptVersion = 11; // Force re-run with 12.4
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Done.');
  }
}

run();
