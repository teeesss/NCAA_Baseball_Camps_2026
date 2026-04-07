const fs = require("fs");
const path = require("path");
const { validateUrl } = require("./src/utils/url_validator");

const DATA_FILE = "camps_data.json";
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

let invalidCount = 0;

data.forEach((school) => {
  if (school.campUrl && school.campUrl !== "TBA") {
    const check = validateUrl(school.campUrl, school.university);
    if (!check.passed) {
      console.log(
        `Purging ${check.reason}: ${school.university} -> ${school.campUrl}`,
      );
      school.campUrl = "TBA";
      school.isChecked = false; // Trigger re-extraction
      invalidCount++;
    }
  }
});

if (invalidCount > 0) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

console.log(`Mass cleanup complete. Purged ${invalidCount} invalid URLs.`);
