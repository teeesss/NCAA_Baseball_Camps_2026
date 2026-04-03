/**
 * AUTO-VERIFY STAMP
 * ============================================================
 * Stamps autoVerified / autoVerifiedPartial fields on every
 * record in camps_data.json based on what data is present.
 *
 * Criteria:
 *   autoVerified = true        ← has campUrl + real 2026 dates + cost ($XX)
 *   autoVerifiedPartial = true ← has campUrl + (dates OR cost) but not both
 *   (all others remain false)
 *
 * Human verification (humanVerifications count) is managed
 * separately by verify_human.php on the live server.
 *
 * Usage:  node auto_verify.js
 * ============================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'camps_data.json');

const GENERIC_PATTERNS = [
  'google.com', 'bing.com', 'duckduckgo.com', 'wikipedia.org', 'ncaa.org'
];

const DATE_REGEX = [
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:[-–]\d{1,2})?,?\s*2026/i,
  /\d{1,2}\/\d{1,2}\/2026/,
  /2026[-/]\d{2}[-/]\d{2}/,
];

function isGenericUrl(url) {
  if (!url || !url.startsWith('http')) return true;
  return GENERIC_PATTERNS.some(p => url.includes(p));
}

function hasRealDate(record) {
  const text = [
    record.dates || '',
    ...(record.campTiers || []).map(t => t.dates || ''),
  ].join(' ');
  return DATE_REGEX.some(r => r.test(text));
}

function hasRealCost(record) {
  const text = [
    record.cost || '',
    ...(record.campTiers || []).map(t => t.cost || ''),
  ].join(' ');
  
  const match = text.match(/\$\s*(\d{2,})/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 75) return true;
  }
  return false;
}

function run() {
  console.log('\n🏷️  AUTO-VERIFY STAMP');
  console.log('=====================================\n');

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  let autoVerifiedCount        = 0;
  let autoVerifiedPartialCount = 0;
  let changedCount             = 0;

  for (const record of data) {
    const hasUrl   = !isGenericUrl(record.campUrl);
    const hasDates = hasRealDate(record);
    const hasCost  = hasRealCost(record);

    const newAutoVerified        = hasUrl && hasDates && hasCost;
    const newAutoVerifiedPartial = hasUrl && (hasDates || hasCost) && !(hasDates && hasCost);

    if (record.autoVerified !== newAutoVerified || record.autoVerifiedPartial !== newAutoVerifiedPartial) {
      changedCount++;
    }

    record.autoVerified        = newAutoVerified;
    record.autoVerifiedPartial = newAutoVerifiedPartial;

    if (newAutoVerified)        autoVerifiedCount++;
    if (newAutoVerifiedPartial) autoVerifiedPartialCount++;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`✅ Auto-Verified (full):    ${autoVerifiedCount}`);
  console.log(`🔶 Auto-Verified (partial): ${autoVerifiedPartialCount}`);
  console.log(`❌ Not verified:            ${data.length - autoVerifiedCount - autoVerifiedPartialCount}`);
  console.log(`\n💾 Updated ${changedCount} records in camps_data.json\n`);
}

run();
