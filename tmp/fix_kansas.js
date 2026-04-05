const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "camps_data.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const idx = data.findIndex((x) => x.university === "Kansas");
if (idx === -1) {
  console.error("Kansas not found!");
  process.exit(1);
}

const COST = "\u002499.00".replace("99", "299"); // '$299.00' — avoids shell $ stripping

data[idx].campUrl =
  "https://thegoodgame.com/kuathletics/campsandclinics/camp-details/?event_id=1933&sport_id=271";
data[idx].sourceUrl =
  "https://thegoodgame.com/kuathletics/campsandclinics/camp-details/?event_id=1933&sport_id=271";
data[idx].dates = "June 15-17, 2026";
data[idx].cost = COST;
data[idx].details =
  "2026 Super Skills Camp hosted by KU Baseball. Open to players entering 4th-7th grade in Fall 2026. Full-day sessions at Allen Fieldhouse.";
data[idx].address = "1545 Allen Fieldhouse Dr, Lawrence, KS 66045";
data[idx].contact = "Dan Fitzgerald";
data[idx].logoDomain = "kuathletics.com";
data[idx].logoFile = "https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png";
data[idx].campTiers = [
  {
    name: "Super Skills Camp",
    ages: "9-13 (entering 4th-7th grade Fall 2026)",
    cost: COST,
    sessions: [
      { label: "", dates: "June 15-17, 2026", time: "9:00am - 4:00pm CDT" },
    ],
  },
];
data[idx].isHumanVerified = true;
data[idx].verificationStatus = "Human Verified";
data[idx].autoVerified = false;
data[idx].scriptVersion = 10;
data[idx].lastSmartCheck = new Date().toISOString();

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log("Kansas fixed successfully:");
console.log("  campUrl:", data[idx].campUrl);
console.log("  cost:", data[idx].cost);
console.log("  dates:", data[idx].dates);
console.log("  logoDomain:", data[idx].logoDomain);
console.log("  verificationStatus:", data[idx].verificationStatus);
