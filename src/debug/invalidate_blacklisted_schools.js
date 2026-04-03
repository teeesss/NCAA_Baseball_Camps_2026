const fs = require('fs');

const DATA_PATH = 'camps_data.json';
const BLACKLIST_PATH = 'blacklist.json';

function invalidate() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const blacklist = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf8')).domains;
  
  let count = 0;
  
  for (const school of data) {
    if (!school.campUrl) continue;
    
    const isBlacklisted = blacklist.some(domain => {
      try {
        const urlObj = new URL(school.campUrl);
        return urlObj.hostname.includes(domain);
      } catch (e) {
        return false;
      }
    });
    
    if (isBlacklisted) {
      console.log(`[BLACKLISTED] Invalidating ${school.university}: ${school.campUrl}`);
      school.campUrl = null;
      school.isChecked = false;
      school.isVerified = false; // Force re-verify if it was a false positive
      school.autoVerified = false;
      school.autoVerifiedPartial = false;
      count++;
    }
  }
  
  if (count > 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`Successfully invalidated ${count} schools for re-extraction.`);
  } else {
    console.log('No schools found with blacklisted URLs.');
  }
}

invalidate();
