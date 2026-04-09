/**
 * heal_database.js
 * Restores lost email data from the largest available backup.
 */

const fs = require('fs');
const path = require('path');

const MASTER_FILE = 'camps_data.json';
const BACKUP_FILE = 'camps_data_backup_1775704237197.json';

function heal() {
  console.log('🩹 HEALING DATABASE EMAILS...');
  
  if (!fs.existsSync(MASTER_FILE) || !fs.existsSync(BACKUP_FILE)) {
    console.error('Error: Required files missing.');
    return;
  }

  const master = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));

  let healedCount = 0;

  master.forEach(m => {
    // Check if master email is missing or N/A
    if (!m.email || m.email === 'N/A') {
      const b = backup.find(x => x.university === m.university);
      if (b) {
        // Heal from backup email or campPOCEmail
        const recoveredEmail = b.email || b.campPOCEmail || '';
        if (recoveredEmail && recoveredEmail !== 'N/A' && recoveredEmail.includes('@')) {
          m.email = recoveredEmail;
          
          // Also check if we can heal contact name/string
          if (b.contact && b.contact.includes('@') && (!m.contact || !m.contact.includes('@'))) {
            m.contact = b.contact;
          }
          if (b.campPOC && b.campPOC !== 'N/A' && (!m.campPOC || m.campPOC === 'N/A')) {
              m.campPOC = b.campPOC;
          }

          healedCount++;
          // console.log(`[HEALED] ${m.university}: ${m.email}`);
        }
      }
    }
  });

  fs.writeFileSync(MASTER_FILE, JSON.stringify(master, null, 2));
  console.log(`\n✅ DATABASE HEALED: Restored emails for ${healedCount} schools.`);
}

heal();
