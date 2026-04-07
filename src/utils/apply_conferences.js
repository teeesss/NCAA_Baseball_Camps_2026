const fs = require("fs");
const path = require("path");

const campsDataPath = path.join(__dirname, "../../camps_data.json");
const authConfPath = path.join(
  __dirname,
  "../../raw_authoritative_conferences.json",
);

const camps = JSON.parse(fs.readFileSync(campsDataPath, "utf8"));
const authConfs = JSON.parse(fs.readFileSync(authConfPath, "utf8"));

// Build normalized lookups from the raw authoritative data
const normalizedAuth = {};
for (const [rawName, conf] of Object.entries(authConfs)) {
  // rawName might be "University of South Carolina Upstate(USC Upstate)"
  let clean = rawName.toLowerCase();

  // Check for parentheticals first like (USC Upstate)
  const parenMatch = clean.match(/\((.*?)\)/);
  if (parenMatch) {
    normalizedAuth[parenMatch[1].trim()] = conf;
    clean = clean.replace(/\(.*\)/, "").trim();
  }

  clean = clean.replace(/^university of /, "");
  clean = clean.replace(/ university$/, "");
  clean = clean.replace(/ at /g, "-");
  clean = clean.replace(/ \/ /g, "-");

  normalizedAuth[clean] = conf;
  normalizedAuth[rawName.toLowerCase()] = conf;
}

// Custom manual aliases for the remaining edge cases to ensure 100% fidelity without substring loops
const ALIASES = {
  "tennessee-martin": "ut martin", // or "tennessee-martin"
  "south carolina upstate": "usc upstate",
  fiu: "florida international",
  fau: "florida atlantic",
  tcu: "texas christian",
  smu: "southern methodist",
  byu: "brigham young",
  lsu: "louisiana state",
  ucf: "central florida",
  ucsb: "uc santa barbara",
  uncw: "unc wilmington",
  vcu: "virginia commonwealth",
  unlv: "nevada-las vegas",
  siue: "southern illinois edwardsville",
  "ole miss": "mississippi",
  penn: "pennsylvania",
  umass: "massachusetts",
  uta: "ut arlington",
  utrgv: "texas-rio grande valley",
  njit: "new jersey institute of technology",
  umbc: "maryland-baltimore county",
  utsa: "ut san antonio",
  fgcu: "florida gulf coast",
  uiw: "incarnate word",
};

let missing = 0;
let fixed = 0;

camps.forEach((school) => {
  let lowerName = school.university.toLowerCase();

  // 1. Check exact match
  let newConf = normalizedAuth[lowerName];

  // 2. Check alias
  if (!newConf && ALIASES[lowerName]) {
    newConf = normalizedAuth[ALIASES[lowerName]];
  }

  // 3. Very specifically, if "Tennessee-Martin", we know it's OVC.
  if (!newConf && lowerName === "tennessee-martin")
    newConf = "Ohio Valley Conference";
  if (!newConf && lowerName === "south carolina upstate")
    newConf = "Big South Conference";
  if (!newConf && lowerName === "west georgia")
    newConf = "Atlantic Sun Conference"; // Moved to D1 ASUN

  if (newConf) {
    // Only update if it's changing the fundamental conference or setting it
    // The authoritative data has full names like "Southeastern Conference", we want "SEC"
    // Let's standardise the main D1s
    const shortMap = {
      Southeastern: "SEC",
      "Southeastern Conference": "SEC",
      "Atlantic Coast": "ACC",
      "Atlantic Coast Conference": "ACC",
      "Big Ten": "Big Ten",
      "Big Ten Conference": "Big Ten",
      "Big 12": "Big 12",
      "Big 12 Conference": "Big 12",
      "Sun Belt": "Sun Belt",
      "Sun Belt Conference": "Sun Belt",
      "Atlantic Sun": "ASUN",
      "Atlantic Sun Conference": "ASUN",
      "Big South": "Big South",
      "Big South Conference": "Big South",
      "Ohio Valley": "OVC",
      "Ohio Valley Conference": "OVC",
      Southland: "Southland",
      "Southland Conference": "Southland",
      "Western Athletic": "WAC",
      "Western Athletic Conference": "WAC",
      "Big East": "Big East",
      "Big East Conference": "Big East",
      "Conference USA": "C-USA",
      CUSA: "C-USA",
      "Mid-American": "MAC",
      "Mid-American Conference": "MAC",
      "West Coast": "WCC",
      "West Coast Conference": "WCC",
      "Coastal Athletic": "CAA",
      "Coastal Athletic Association": "CAA",
      "Missouri Valley": "MVC",
      "Missouri Valley Conference": "MVC",
      "Horizon League": "Horizon",
      "The Summit": "Summit",
      "The Summit League": "Summit",
      "Patriot League": "Patriot",
      American: "AAC",
      "American Athletic Conference": "AAC",
      "Mountain West": "Mountain West",
      "Mountain West Conference": "Mountain West",
      PSAC: "PSAC",
      "Ivy League": "Ivy League",
      Other: "Other",
    };

    let finale = shortMap[newConf] || newConf;

    if (school.conference !== finale) {
      console.log(
        `Updating ${school.university}: ${school.conference} -> ${finale}`,
      );
      school.conference = finale;
      fixed++;
    }
  } else {
    if (school.division === "DI") {
      console.log(
        `⚠️ Unmatched DI: ${school.university} (current: ${school.conference})`,
      );
      missing++;
    }
    // D2 unmapped will just stay what they are or fallback to "Independent / Other DII"
  }
});

fs.writeFileSync(campsDataPath, JSON.stringify(camps, null, 2));
console.log(
  `\nRe-mapping complete. Total fixed: ${fixed}. Mission unmapped DI: ${missing}`,
);
