const fs = require('fs');
const https = require('https');
const http = require('http');

async function checkLink(url) {
  if (!url || !url.startsWith('http')) return { status: 'INVALID', url };
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    try {
      const req = lib.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve({ status: res.statusCode, url });
      });
      req.on('error', (e) => resolve({ status: 'ERROR', message: e.message, url }));
      req.end();
    } catch (e) {
      resolve({ status: 'ERROR', message: e.message, url });
    }
  });
}

async function verify() {
  const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
  const results = [];
  const MAX_CONCURRENT = 10;
  
  // Only check first 50 as a sample for now
  const subset = data.slice(0, 50).filter(s => s.campUrl);
  
  console.log(`Verifying ${subset.length} samples...`);
  for (let i = 0; i < subset.length; i += MAX_CONCURRENT) {
    const chunk = subset.slice(i, i + MAX_CONCURRENT);
    const checks = chunk.map(s => checkLink(s.campUrl));
    results.push(...(await Promise.all(checks)));
  }

  const failures = results.filter(r => r.status !== 200 && r.status !== 301 && r.status !== 302);
  fs.writeFileSync('src/debug/link_verification_report.json', JSON.stringify({
    totalChecked: subset.length,
    failures
  }, null, 2));
  console.log('Report saved to src/debug/link_verification_report.json');
}

verify();
