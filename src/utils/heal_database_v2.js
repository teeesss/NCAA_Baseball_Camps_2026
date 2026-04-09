/**
 * heal_database_v2.js
 * Restores lost email data from the largest available backup.
 * Extra loud logging to debug why v1 failed.
 */

const fs = require('fs');

const MASTER_FILE = 'camps_data.json';
const BACKUP_FILE = 'camps_data_backup_1775704237197.json';

function heal() {
  console.log('🩹 HEALING DATABASE V2...');
  
  if (!fs.existsSync(MASTER_FILE) || !fs.existsSync(BACKUP_FILE)) {
    console.error('Error: Required files missing.');
    return;
  }

  const master = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));

  console.log(`Master records: ${master.length}`);
  console.log(`Backup records: ${backup.length}`);

  let healedCount = 0;
  let matchCount = 0;

  master.forEach(m => {
    const b = backup.find(x => x.university.trim().toLowerCase() === m.university.trim().toLowerCase());
    if (b) {
      matchCount++;
      
      const masterEmail = (m.email || '').trim();
      const backupEmail = (b.email || b.campPOCEmail || '').trim();

      // Heal if master is empty or N/A, and backup has something valid
      if ((!masterEmail || masterEmail === 'N/A') && backupEmail && backupEmail !== 'N/A' && backupEmail.includes('@')) {
        m.email = backupEmail;
        m.campPOCEmail = backupEmail; // Sync both for V11
        
        // Also heal POC name if missing
        if (!m.campPOC || m.campPOC === 'N/A') {
          if (b.campPOC && b.campPOC !== 'N/A') m.campPOC = b.campPOC;
        }

        healedCount++;
        if (healedCount < 10) console.log(` [RESTORED] ${m.university}: ${m.email}`);
      }
    }
  });

  console.log(`Matched schools: ${matchCount}`);
  console.log(`Healed schools: ${healedCount}`);

  if (healedCount > 0) {
    fs.writeFileSync(MASTER_FILE, JSON.stringify(master, null, 2));
    console.log(`✅ SUCCESS: ${MASTER_FILE} updated.`);
  } else {
    console.log('⚠️ No records needed healing (or matches found).');
  }
}

heal();
