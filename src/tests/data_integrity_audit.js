const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const SUSPICIOUS_THRESHOLDS = {
  MIN_COST: 75,
  PLACEHOLDER_PATTERN: /06\/20|07\/20|08\/20|20th/,
  MAX_DATES_LOGICAL: 12
};

const BANNED_KEYWORDS = [
    'fieldlevel', 'activekids', 'berecruited', 'perfectgame', 'maxpreps'
];

async function audit() {
  console.log('\n🔍 DATA INTEGRITY AUDIT');
  console.log('=====================================\n');

  const suspicious = [];
  const errors = [];

  for (const record of data) {
    let issues = [];

    // 1. Cost Check
    if (record.cost && record.cost !== 'TBA') {
      const match = record.cost.match(/\$\s*(\d{1,})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val < SUSPICIOUS_THRESHOLDS.MIN_COST && val > 0) {
          issues.push(`SUSPICIOUS_COST: ${record.cost} (< $${SUSPICIOUS_THRESHOLDS.MIN_COST})`);
        }
      }
    }

    // 2. Placeholder Dates
    if (record.dates && record.dates !== 'TBA') {
      if (SUSPICIOUS_THRESHOLDS.PLACEHOLDER_PATTERN.test(record.dates)) {
        issues.push(`PLACEHOLDER_DATES: Detected "20th" or "XX/20" pattern: ${record.dates}`);
      }
      const dateCount = record.dates.split('|').length;
      if (dateCount > SUSPICIOUS_THRESHOLDS.MAX_DATES_LOGICAL) {
        issues.push(`OVERFLOW_DATES: Found ${dateCount} separate dates (likely generic calendar scrape)`);
      }
    }

    // 3. Blacklisted Domains / Content Cross-Contamination
    const combined = (record.campUrl || '') + ' ' + (record.details || '');
    if (BANNED_KEYWORDS.some(k => combined.toLowerCase().includes(k))) {
      issues.push(`BLACK_KEYWORDS: Source linked to third-party aggregator patterns: ${record.campUrl}`);
    }

    // 4. Cross-School Contamination
    // If the details or name contains a likely rival school name we check here
    // For now simple keyword check against manual reported cases
    if (record.university.includes('South Dakota State') && record.dates.includes('SMU')) {
        issues.push(`CROSS_CONTAMINATION: Contains SMU data in South Dakota State record.`);
    }

    if (issues.length > 0) {
      suspicious.push({
        university: record.university,
        issues,
        url: record.campUrl
      });
    }
  }

  // Report
  if (suspicious.length === 0) {
    console.log('✅ ALL RECORDS PASSED INITIAL INTEGRITY AUDIT.');
  } else {
    console.log(`⚠️  FOUND ${suspicious.length} SUSPICIOUS RECORDS:\n`);
    suspicious.forEach(s => {
      console.log(`[ ${s.university} ]`);
      s.issues.forEach(i => console.log(`  ↳ ${i}`));
      console.log(`  URL: ${s.url}\n`);
    });

    console.log('-------------------------------------');
    console.log(`Summary: ${suspicious.length} suspicious entries found.`);
    console.log('Run node src/tests/scrub_bad_data.js to clear these if they are false positives.');
  }
}

audit();
