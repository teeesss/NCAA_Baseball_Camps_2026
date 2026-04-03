/**
 * fix_bad_costs.js
 * One-time surgical fix for confirmed bad cost records.
 * Run: node src/tests/fix_bad_costs.js
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const FIXES = [
  {
    university: 'LSU',
    reason: 'cost field is corrupted comma-only string (", , , ") — no actual price data',
    setCost: null,
    setCampUrl: null, // keep lsubaseballcamps.com — it's valid
  },
  {
    university: 'Illinois',
    reason: 'cost "$59.99" is below $100 floor and from stale 2015 athletics URL — not a real camp price',
    setCost: null,
    setCampUrl: null, // clear old 2015 URL
  },
  {
    university: 'West Texas A&M University',
    reason: 'cost "$50" is below $100 floor; campUrl is a DuckDuckGo redirect to a FOOTBALL camp — wrong sport',
    setCost: null,
    setCampUrl: null, // nuke the football camp URL
  },
];

let fixed = 0;
FIXES.forEach(fix => {
  const record = data.find(d => d.university === fix.university);
  if (!record) {
    console.log(`⚠️  Could not find: ${fix.university}`);
    return;
  }

  console.log(`\n🔧 Fixing: ${fix.university}`);
  console.log(`   Reason: ${fix.reason}`);
  console.log(`   Before: cost=${JSON.stringify(record.cost)}, campUrl=${record.campUrl}`);

  if (fix.setCost !== undefined && fix.setCost === null) {
    record.cost = null;
  }
  if (fix.setCampUrl !== undefined && fix.setCampUrl === null) {
    // Only clear if the URL is bad (football redirect or super stale)
    if (fix.university === 'LSU') {
      // LSU campUrl is good — keep it
      console.log(`   Keeping campUrl: ${record.campUrl}`);
    } else {
      record.campUrl = null;
    }
  }

  console.log(`   After:  cost=${JSON.stringify(record.cost)}, campUrl=${record.campUrl}`);
  fixed++;
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log(`\n✅ Fixed ${fixed} records. camps_data.json saved.`);
