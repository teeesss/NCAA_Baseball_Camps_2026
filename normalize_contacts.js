// normalize_contacts.js - extract campPOC (name), campPOCEmail (email), keep headCoach separate
// Removes both contact and email fields
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

let stats = {
  splitFromContact: 0,
  nameFromContact: 0,
  nothingFound: 0,
  alreadyHadCampPOC: 0,
  removedContact: 0,
  emailRenamed: 0,
};

data.forEach((school) => {
  const rawContact = (school.contact || "").trim();
  const existingEmail = (school.email || "").trim();

  // Rename email → campPOCEmail (keep authoritative email value)
  if (existingEmail && existingEmail !== "N/A" && existingEmail !== "TBA") {
    school.campPOCEmail = existingEmail;
    stats.emailRenamed++;
  } else if (
    !school.campPOCEmail ||
    school.campPOCEmail === "N/A" ||
    school.campPOCEmail === ""
  ) {
    school.campPOCEmail = "";
  }

  // Determine campPOC: extract only the NAME from contact
  if (!school.campPOC || school.campPOC === "N/A" || school.campPOC === "") {
    if (rawContact.includes(" | ") && rawContact.includes("@")) {
      // "Name | email@domain" - take only the name part
      const [namePart] = rawContact.split(" | ");
      const name = namePart.trim();
      if (name && name !== "Not Listed") {
        school.campPOC = name;
        stats.splitFromContact++;
      } else {
        stats.nothingFound++;
      }
    } else if (
      rawContact &&
      !rawContact.includes("@") &&
      rawContact !== "N/A" &&
      rawContact !== "TBA" &&
      rawContact !== "Not Listed"
    ) {
      // Name-only contact
      school.campPOC = rawContact;
      stats.nameFromContact++;
    } else {
      stats.nothingFound++;
    }
  } else {
    stats.alreadyHadCampPOC++;
  }

  // Remove both old fields
  delete school.contact;
  delete school.email;
  stats.removedContact++;
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log("Contact normalization complete:");
console.log("  'Name | Email' split → campPOC:", stats.splitFromContact);
console.log("  Name-only contact → campPOC:", stats.nameFromContact);
console.log("  Already had campPOC (kept):", stats.alreadyHadCampPOC);
console.log("  No name found in contact:", stats.nothingFound);
console.log("  email → campPOCEmail:", stats.emailRenamed);
console.log(
  "  Removed 'contact' + 'email' fields from all:",
  stats.removedContact,
);
console.log(`\nFinal schema fields: campPOC, campPOCEmail, headCoach`);
console.log(`Total records: ${data.length}`);
