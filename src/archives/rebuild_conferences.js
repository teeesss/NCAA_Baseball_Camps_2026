const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const MAP_FILE = path.join(__dirname, "master_conference_map.json");

function rebuild() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

  // Flatten map for easy lookup
  const lookup = {};
  Object.keys(map).forEach((conf) => {
    map[conf].forEach((school) => {
      lookup[school.toLowerCase()] = conf;
    });
  });

  // Special exact overrides for common problematic substring matches
  const explicitOverrides = {
    "Central Arkansas": "ASUN",
    "Arkansas State": "Sun Belt",
    "Arkansas-Pine Bluff": "SWAC",
    "Southern Arkansas University": "GAC", // DII
    "Arkansas Tech University": "GAC", // DII
    "East Tennessee State": "Southern",
    "Georgia Southern": "Sun Belt",
    "Georgia State": "Sun Belt",
    "Georgia College & State University": "Peach Belt", // DII
    "South Alabama": "Sun Belt",
    "Alabama A&M": "SWAC",
    "Alabama State": "SWAC",
    "Florida A&M": "SWAC",
    "Florida State": "ACC",
    "Florida Gulf Coast": "ASUN",
    "Mississippi Valley State": "SWAC",
  };

  let fixedCount = 0;

  data.forEach((school) => {
    const uni = school.university.trim();
    const uniLower = uni.toLowerCase();

    let conference = "Other";

    // 1. Check Explicit Overrides First
    if (explicitOverrides[uni]) {
      conference = explicitOverrides[uni];
    }
    // 2. Check Master Map (Exact Match)
    else if (lookup[uniLower]) {
      conference = lookup[uniLower];
    }
    // 3. Fallback for Division II schools if not in map
    else if (school.division === "DII") {
      // Keep existing if it looks like a DII conference (not SEC/ACC/etc)
      const powerConf = ["SEC", "ACC", "Big Ten", "Big 12", "Pac-12"];
      if (powerConf.includes(school.conference)) {
        conference = "Other DII"; // Flag for manual fix
      } else {
        conference = school.conference || "Other DII";
      }
    } else {
      conference = school.conference || "Other";
    }

    if (school.conference !== conference) {
      console.log(`🔧 [${uni}] ${school.conference} -> ${conference}`);
      school.conference = conference;
      fixedCount++;
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(
    `\n✅ Finished rebuilding conferences. Fixed ${fixedCount} entries.`,
  );
}

rebuild();
