const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "camps_data.json");

function run() {
  console.log("🚀 Starting Final Data Cleanup & Backfill...");

  if (!fs.existsSync(DATA_FILE)) {
    console.error("Master database not found!");
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const nowISO = new Date().toISOString();
  const nowEpoch = Date.now();

  let removedFieldsCount = 0;
  let backfilledTimestampsCount = 0;
  let sourceUrlBackfillCount = 0;
  let conflictResolvedCount = 0;

  data.forEach((record) => {
    // 1. Remove Dead Fields
    if (record.hasOwnProperty("campDetails")) {
      delete record.campDetails;
      removedFieldsCount++;
    }
    if (record.hasOwnProperty("divisionLevel")) {
      delete record.divisionLevel;
      removedFieldsCount++;
    }

    // 2. Backfill Timestamps from lastUpdateDate
    // Note: UI logic expects epoch numbers or ISO strings. lastUpdateDate is currently mixed.
    const baseTime = record.lastUpdateDate || nowEpoch;

    if (!record.datesUpdateDate && record.dates && record.dates !== "TBA") {
      record.datesUpdateDate = baseTime;
      backfilledTimestampsCount++;
    }
    if (
      !record.contactUpdateDate &&
      (record.contact || (record.email && record.email !== "N/A"))
    ) {
      // If contact is N/A but email is valid, we consider it a contact update
      if (!record.contactUpdateDate) {
        record.contactUpdateDate = baseTime;
        backfilledTimestampsCount++;
      }
    }
    if (!record.costUpdateDate && record.cost && record.cost !== "TBA") {
      record.costUpdateDate = baseTime;
      backfilledTimestampsCount++;
    }
    if (
      !record.urlUpdateDate &&
      record.url &&
      record.url !== "TBA" &&
      record.url !== ""
    ) {
      record.urlUpdateDate = baseTime;
      backfilledTimestampsCount++;
    }

    // 3. sourceUrl Backfill
    if (!record.sourceUrl && (record.campUrl || record.url)) {
      record.sourceUrl = record.campUrl || record.url;
      sourceUrlBackfillCount++;
    }

    // 4. Manual Conflict Fixes
    if (record.university.includes("Richmond")) {
      console.log("   [FIX] Richmond Spiders data update...");
      record.dates = "June 16-17, July 29-30, July 11-14, August 8-11, 2026";
      record.campTiers = [
        {
          name: "North to South Academic Prospect Camp I",
          dates: "June 16-17, 2026",
          cost: "TBA",
        },
        {
          name: "North to South Academic Prospect Camp II",
          dates: "July 29-30, 2026",
          cost: "TBA",
        },
        {
          name: "Spiders Summer Youth Camp I",
          dates: "July 11-14, 2026",
          cost: "TBA",
        },
        {
          name: "Spiders Summer Youth Camp II",
          dates: "August 8-11, 2026",
          cost: "TBA",
        },
      ];
      record.lastUpdateDate = nowEpoch;
      record.datesUpdateDate = nowEpoch;
      record.isChecked = true;
      record.scriptVersion = 15;
      conflictResolvedCount++;
    }

    if (record.university.includes("Ouachita Baptist")) {
      console.log("   [FIX] Ouachita Baptist data update...");
      record.dates = "June 9-11, July 14, 2026";
      record.campTiers = [
        {
          name: "Youth Summer Skills Camp",
          dates: "June 9-11, 2026",
          cost: "TBA",
        },
        { name: "Summer Prospect Camp", dates: "July 14, 2026", cost: "TBA" },
      ];
      record.lastUpdateDate = nowEpoch;
      record.datesUpdateDate = nowEpoch;
      record.isChecked = true;
      record.scriptVersion = 15;
      conflictResolvedCount++;
    }

    if (record.university.includes("Thomas Jefferson")) {
      console.log("   [FIX] Thomas Jefferson data marked TBA...");
      record.dates = "TBA";
      record.campTiers = [];
      record.lastUpdateDate = nowEpoch;
      record.isChecked = true;
      record.scriptVersion = 15;
      conflictResolvedCount++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`\n✅ Results:`);
  console.log(`   - Dead fields removed: ${removedFieldsCount}`);
  console.log(`   - Timestamps backfilled: ${backfilledTimestampsCount}`);
  console.log(`   - sourceUrl backfilled: ${sourceUrlBackfillCount}`);
  console.log(`   - Conflicts resolved: ${conflictResolvedCount}`);
  console.log(`\n💾 Master database updated and saved.`);
}

run();
