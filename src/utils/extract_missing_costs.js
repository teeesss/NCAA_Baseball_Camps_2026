/**
 * extract_missing_costs.js
 * Runs V12 extraction on schools that have dates but no costs.
 */

const fs = require('fs');
const { execSync } = require('child_process');

const DATA_FILE = 'camps_data.json';

function run() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const missing = data.filter(d => d.dates && d.dates !== 'TBA' && (!d.cost || d.cost === 'TBA'));
  
  console.log(`🚀 Found ${missing.length} schools with dates but no cost.`);
  
  // We'll process them one by one using smart_extract.js
  // To avoid hitting rate limits or crashing, we do it sequentially.
  for (let i = 0; i < missing.length; i++) {
    const school = missing[i].university;
    console.log(`\n[${i+1}/${missing.length}] Processing ${school}...`);
    try {
      // Use --force to ensure we re-check even if isChecked is true
      execSync(`node smart_extract.js --school=\"${school}\" --force`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed on ${school}: ${e.message}`);
    }
  }
  
  console.log('\n✅ Batch processing complete.');
}

run();
