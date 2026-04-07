const fs = require("fs");

const campsData = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
const externalData = JSON.parse(
  fs.readFileSync("baseballcampsusa_parsed.json", "utf8"),
);

let matchCount = 0;
let updateCount = 0;

const normalized = (name) =>
  name
    .toLowerCase()
    .replace(/university/g, "")
    .replace(/univ/g, "")
    .replace(/college/g, "")
    .replace(/state/g, "")
    .replace(/baseball/g, "")
    .replace(/camps/g, "")
    .replace(/camp/g, "")
    .replace(/crimson tide/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

externalData.forEach((ext) => {
  // Basic filter for baseball only
  const lowerSchool = ext.school.toLowerCase();
  const otherSports = [
    "basketball",
    "soccer",
    "softball",
    "volleyball",
    "tennis",
    "lacrosse",
    "football",
  ];
  if (
    otherSports.some((sport) => lowerSchool.includes(sport)) &&
    !lowerSchool.includes("baseball")
  ) {
    return;
  }

  const extName = normalized(ext.school);
  if (!extName) return;

  // Search for matching school
  const match = campsData.find((item) => {
    const itemName = normalized(item.university);
    // FORCE ALABAMA RULE:
    if (itemName === "alabama" || extName === "alabama") {
      return itemName === "alabama" && extName === "alabama";
    }
    return itemName === extName;
  });

  if (match) {
    matchCount++;
    const isBetter =
      ext.url.includes("baseball") ||
      ext.url.includes("camp") ||
      !ext.url.includes("athletics.com");

    if (isBetter && match.url !== ext.url) {
      console.log(`Updating ${match.university}: ${match.url} -> ${ext.url}`);
      match.url = ext.url;
      match.isChecked = false;
      match.auditStatus = "NEW_SOURCE_DETECTED";
      updateCount++;
    }
  }
});

fs.writeFileSync("camps_data.json", JSON.stringify(campsData, null, 2));
console.log(
  `Summary: Matched ${matchCount} schools, Updated ${updateCount} URLs.`,
);
