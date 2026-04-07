const fs = require("fs");
const path = require("path");

const DATA_FILE = "camps_data.json";
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const badSchools = [
  "Sam Houston State",
  "Gannon University",
  "Georgia Southwestern State University",
  "University of Central Oklahoma",
  "Florida Tech",
  "University of North Carolina at Pembroke",
];

let fixed = 0;

data.forEach((school) => {
  // Purge search engine redirects
  if (school.campUrl && school.campUrl.includes("duckduckgo.com")) {
    console.log(`Purging DDG URL for ${school.university}: ${school.campUrl}`);
    school.campUrl = "TBA";
    school.isChecked = false;
    fixed++;
  }

  // Purge specific mangled URLs identified in tests
  if (
    school.university.includes("Gannon") &&
    school.campUrl &&
    school.campUrl.includes("/search")
  ) {
    console.log(`Purging Gannon search URL: ${school.campUrl}`);
    school.campUrl = "TBA";
    school.isChecked = false;
    fixed++;
  }

  if (
    school.university.includes("Florida Tech") &&
    school.campUrl &&
    school.campUrl.includes("ncsasports.org")
  ) {
    console.log(`Purging Florida Tech blacklist URL: ${school.campUrl}`);
    school.campUrl = "TBA";
    school.isChecked = false;
    fixed++;
  }

  // Any other mangled garbage identified in audit (Suite 4)
  if (
    school.campUrl &&
    (school.campUrl.includes("kidvoyage.com") ||
      school.campUrl.includes("kamalkitchen.com"))
  ) {
    console.log(`Purging Spam URL for ${school.university}: ${school.campUrl}`);
    school.campUrl = "TBA";
    school.isChecked = false;
    fixed++;
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log(`Fixed ${fixed} integrity violations.`);
