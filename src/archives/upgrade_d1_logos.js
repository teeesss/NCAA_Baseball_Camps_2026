/**
 * upgrade_d1_logos.js
 * ============================================================
 * Iterates through all DI schools (or all schools that currently
 * have a favicon) and tries to upgrade them to Clearbit's higher 
 * quality, transparent logos.
 *
 * It tests the Clearbit API URL format: https://logo.clearbit.com/<domain>
 * If it succeeds, it updates the logoFile.
 * ============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE = path.join(__dirname, 'camps_data.json');

function checkClearbit(domain) {
  return new Promise((resolve) => {
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const req = https.request(
      Object.assign(new URL(clearbitUrl), { method: 'HEAD', timeout: 5000 }),
      (res) => {
        resolve(res.statusCode < 400 ? clearbitUrl : null);
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const d1Schools = data.filter(s => s.division === 'DI' && s.logoDomain);

  console.log(`🔍 Found ${d1Schools.length} DI schools to check for better logos.`);

  let upgraded = 0;
  
  for (let i = 0; i < d1Schools.length; i++) {
    const school = d1Schools[i];
    
    // Only process if it isn't already clearbit
    if (school.logoFile && school.logoFile.includes('clearbit.com')) {
      continue;
    }

    const domain = school.logoDomain;
    const clearbitUrl = await checkClearbit(domain);
    
    if (clearbitUrl) {
      school.logoFile = clearbitUrl;
      console.log(`  ✨ Upgraded ${school.university} -> ${clearbitUrl}`);
      upgraded++;
    } else {
      console.log(`  ⏭  Keeping favicon for ${school.university} (Clearbit 404)`);
    }

    // small delay to prevent rate limit
    await sleep(250);
    
    if (i % 25 === 0 && i > 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`💾 Saved checkpoint.`);
    }
  }

  // Also do high-priority fixes (like Arkansas) if their logoDomain is wrong
  // Arkansas Razorbacks might have 'uark.edu' or 'arkansasrazorbacks.com'
  const arkansas = data.find(s => s.university === 'Arkansas');
  if (arkansas) {
     const arkansasClearbit = await checkClearbit('arkansasrazorbacks.com');
     if (arkansasClearbit) {
        arkansas.logoFile = arkansasClearbit;
        console.log(`  🐗 Upgraded Arkansas to ${arkansasClearbit}`);
     } else {
        const uarkClearbit = await checkClearbit('uark.edu');
        if (uarkClearbit) {
           arkansas.logoFile = uarkClearbit;
           console.log(`  🐗 Upgraded Arkansas to ${uarkClearbit}`);
        }
     }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`\n✅ Done! Upgraded ${upgraded} DI logos to Clearbit.`);
  console.log(`Run node generate_html.js to see changes.`);
}

run().catch(console.error);
