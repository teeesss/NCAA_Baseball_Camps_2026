const fs = require("fs");

const dataFile = "camps_data.json";
const textFile = "additional.camps.full.txt";
let data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const textContent = fs.readFileSync(textFile, "utf8");

// Parse the table
const lines = textContent.split("\n");
let mergeCount = 0;

for (let line of lines) {
  if (!line.trim().startsWith("|")) continue;

  // Format: | **University** | [Name](URL) | Dates | Cost | Details | Contact |
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 6) continue;
  if (parts[1].startsWith("---") || parts[1].startsWith("University")) continue;

  let university = parts[1].replace(/\*\*/g, "").trim();
  if (!university) continue;

  // Normalize names for matching
  // "Central Arkansas, University of" -> "Central Arkansas"
  let matchName = university.split(",")[0].trim();

  let urlMatch = parts[2].match(/\[.*\]\((.*)\)/);
  let campUrl = urlMatch
    ? urlMatch[1]
    : parts[2].includes("http")
      ? parts[2]
      : null;
  let dates = parts[3];
  let cost = parts[4];
  let details = parts[5];

  // Find in database
  let entry = data.find(
    (d) =>
      d.university.toLowerCase() === university.toLowerCase() ||
      d.university.toLowerCase().includes(matchName.toLowerCase()) ||
      matchName.toLowerCase().includes(d.university.toLowerCase()),
  );

  if (entry) {
    // ALWAYS MERGE IF TEXT FILE HAS SPECIFIC DATES (not TBA)
    // OR IF DB IS PLACEHOLDER
    const isBetterData =
      dates !== "TBA" &&
      (entry.dates === "TBA" ||
        entry.dates.includes("No 2026") ||
        entry.dates.includes("International Affairs") ||
        entry.dates.includes("Piano"));
    const isPlaceholder =
      entry.dates === "TBA" || entry.dates.includes("No 2026");

    if (isBetterData || isPlaceholder) {
      console.log(
        `Merging ${entry.university} [${dates}] over [${entry.dates.substring(0, 30)}...]`,
      );

      if (campUrl && campUrl !== "TBA") entry.campUrl = campUrl;
      if (dates) entry.dates = dates;
      if (cost) entry.cost = cost;
      if (details) entry.details = details;

      // Mark as checked to preserve this human-vetted (or higher-fidelity) data
      entry.isChecked = true;
      entry.scriptVersion = 4; // Use 4 to signify "Manually Refined / Merged"
      mergeCount++;
    }
  }
}

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
console.log(`\nDONE: Merged ${mergeCount} records from ${textFile}`);
