const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "camps_data.json");

function run() {
  console.log(
    "🚀 Final Pass: Verifying Manual Fixes & Normalizing POC Emails...",
  );

  if (!fs.existsSync(DATA_FILE)) {
    console.error("Master database not found!");
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const nowEpoch = Date.now();

  let verifiedCount = 0;
  let emailNormalizedCount = 0;
  let urlTimestampCount = 0;

  data.forEach((record) => {
    // 1. Protect manually fixed records
    const manualSchools = ["Richmond", "Ouachita Baptist", "Thomas Jefferson"];
    if (manualSchools.some((s) => record.university.includes(s))) {
      if (!record.isVerified) {
        record.isVerified = true;
        verifiedCount++;
      }
    }

    // 2. Normalize campPOCEmail (UI checks this, Extractor populates 'email')
    if (record.email && record.email !== "N/A") {
      if (record.campPOCEmail !== record.email) {
        record.campPOCEmail = record.email;
        emailNormalizedCount++;
      }
    } else if (record.campPOCEmail && record.campPOCEmail !== "N/A") {
      // Sync reverse if email is missing
      if (!record.email || record.email === "N/A") {
        record.email = record.campPOCEmail;
        emailNormalizedCount++;
      }
    }

    // 3. Fix urlUpdateDate backfill
    if (!record.urlUpdateDate && (record.campUrl || record.url)) {
      record.urlUpdateDate = record.lastUpdateDate || nowEpoch;
      urlTimestampCount++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`\n✅ Results:`);
  console.log(`   - Manually verified flags set: ${verifiedCount}`);
  console.log(`   - campPOCEmail standardized: ${emailNormalizedCount}`);
  console.log(`   - urlUpdateDate backfilled: ${urlTimestampCount}`);
  console.log(`\n💾 Master database updated.`);
}

run();
