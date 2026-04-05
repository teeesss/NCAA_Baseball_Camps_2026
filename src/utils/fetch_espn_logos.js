/**
 * fetch_espn_logos.js
 * ============================================================
 * Pulls high-quality (500x500 PNG transparent) primary logos from
 * the ESPN College Baseball API and matches them to our D1 dataset.
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");

function fetchJson(url) {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

function normalize(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function run() {
  console.log("📡 Fetching ESPN College Baseball Teams...");
  // The ESPN API has about ~300 D1 teams
  const data = await fetchJson(
    "http://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams?limit=400",
  );

  if (
    !data ||
    !data.sports ||
    !data.sports[0] ||
    !data.sports[0].leagues ||
    !data.sports[0].leagues[0]
  ) {
    console.error("❌ Failed to fetch ESPN data.");
    return;
  }

  const espnTeams = data.sports[0].leagues[0].teams.map((t) => t.team);
  console.log(`✅ Loaded ${espnTeams.length} teams from ESPN.`);

  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  let matched = 0;

  for (const school of db) {
    if (school.division !== "DI") continue;

    const u1 = normalize(school.university);
    let bestMatch = null;

    for (const et of espnTeams) {
      const eName = normalize(et.location); // "Arkansas"
      const eFull = normalize(et.displayName); // "Arkansas Razorbacks"
      const eAbbr = normalize(et.abbreviation); // "ARK"

      // Strict matching to prevent "Alabama A&M" matching "Alabama"
      if (u1 === eName || u1 === eFull) {
        bestMatch = et;
        break;
      }
    }

    // Specific manual fallbacks for tricky ones
    if (!bestMatch) {
      const hardcodes = {
        "NC State": "North Carolina State",
        USC: "Southern California",
        UCF: "Central Florida",
        LSU: "Louisiana State",
        TCU: "Texas Christian",
        "Ole Miss": "Mississippi",
        Pitt: "Pittsburgh",
        UMass: "Massachusetts",
        UConn: "Connecticut",
        Penn: "Pennsylvania",
        "Florida International": "FIU",
        "Florida Atlantic": "FAU",
        Arkansas: "Arkansas Razorbacks",
        UNCG: "UNC Greensboro",
        UNCW: "UNC Wilmington",
        ULM: "Louisiana Monroe",
        SIUE: "SIU Edwardsville",
        UTA: "UT Arlington",
        UTRGV: "UT Rio Grande Valley",
        "Tennessee-Martin": "UT Martin",
        "Southeast Missouri": "Southeast Missouri State",
        "Southeastern Louisiana": "Southeastern Louisiana Lions",
        "Saint Mary's College": "Saint Mary's",
        "Saint John's": "St. John's",
        "Saint Bonaventure": "St. Bonaventure",
        "Saint Thomas": "St. Thomas",
        "San Jose State": "San Jose State Spartans",
        "Seattle University": "Seattle U",
        "Mississippi Valley": "Mississippi Valley State",
        "North Carolina State": "NC State",
        "Florida Gulf Coast": "FGCU",
      };
      const hc = hardcodes[school.university];
      if (hc) {
        bestMatch = espnTeams.find(
          (et) =>
            normalize(et.location) === normalize(hc) ||
            normalize(et.displayName) === normalize(hc),
        );
      }
    }

    if (bestMatch && bestMatch.logos && bestMatch.logos.length > 0) {
      // Prioritize the transparent PNG (usually the first one)
      const logoUrl = bestMatch.logos[0].href;
      school.logoFile = logoUrl;
      console.log(
        `  🎯 Matched [${school.university}] => ESPN [${bestMatch.displayName}]`,
      );
      matched++;
    } else {
      console.log(`  ⏭  No ESPN match for [${school.university}]`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  console.log(
    `\n✅ Finished! Upgraded ${matched} DI schools to high-res ESPN logos.`,
  );
  console.log(`Run node generate_html.js to rebuild the site.\n`);
}

run();
