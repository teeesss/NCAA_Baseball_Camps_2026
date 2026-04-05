/**
 * Utility script to apply conference mapping to the database.
 */

const fs = require("fs");
const path = require("path");
const { getConference } = require("./conference_lookup");

const DATA_FILE = path.join(__dirname, "camps_data.json");

function applyConferences() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Database not found at ${DATA_FILE}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`Processing ${data.length} schools...`);

  let updatedCount = 0;
  data.forEach((school) => {
    const conf = getConference(school.university);
    if (!school.conference || school.conference !== conf) {
      school.conference = conf;
      updatedCount++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Applied conferences to ${updatedCount} schools.`);
}

applyConferences();
