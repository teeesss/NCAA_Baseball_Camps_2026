const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const { isContaminated } = require("../utils/contamination_check.js");
const { MASCOT_LOOKUP } = require("../utils/mascot_lookup.js");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const allSchools = data.map((d) => d.university);

// Manual Abbreviations Map for high-fidelity matching
const ABBREVIATION_MAP = {
  Kentucky: ["uk", "wildcats"],
  "Louisiana State": ["lsu", "tigers"],
  LSU: ["lsu", "tigers"],
  "Mississippi State": ["msu", "msst", "bulldogs"],
  NJIT: ["njit", "highlanders"],
  "Texas Christian": ["tcu", "horned frogs"],
  TCU: ["tcu", "horned frogs"],
  "Kansas State": ["k-state", "wildcats"],
  "NC State": ["ncsu", "wolfpack"],
  "North Carolina State": ["ncsu", "wolfpack"],
  UNLV: ["unlv", "rebels"],
  UCF: ["ucf", "knights"],
  UCLA: ["ucla", "bruins"],
  USC: ["usc", "trojans"],
  Vanderbilt: ["vandy", "commodores"],
};

// High-Fidelity Content Audit with Intelligent Alias Matching
async function auditUrlContent(url, schoolName) {
  return new Promise((resolve) => {
    if (!url || url === "TBA") return resolve({ ok: true });

    let settled = false;
    const settle = (ok, reason = "") => {
      if (!settled) {
        settled = true;
        resolve({ ok, reason });
      }
    };

    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return settle(false, "invalid_url");
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      method: "GET",
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NCAABot/1.3; +https://bmwseals.com/)",
      },
      timeout: 15000,
    };

    const req = lib.request(options, (res) => {
      if (res.statusCode >= 400)
        return settle(false, `status_${res.statusCode}`);

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 32768) {
          // 32KB threshold for deep scans
          req.destroy();
          analyze(body);
        }
      });
      res.on("end", () => analyze(body));

      function analyze(html) {
        const text = html.replace(/<[^>]*>?/gm, " ").toLowerCase();
        const schoolLower = schoolName.toLowerCase();
        const mascot = (MASCOT_LOOKUP[schoolName] || "").toLowerCase();
        const aliases = (ABBREVIATION_MAP[schoolName] || []).map((a) =>
          a.toLowerCase(),
        );

        // 1. Basic relevance (Baseball/Camp)
        const baseballKeywords = [
          "baseball",
          "diamond",
          "ballclub",
          "ball",
          "dugout",
          "inning",
        ];
        const hasBaseball = baseballKeywords.some((k) => text.includes(k));
        const hasCamp = /camp|clinic|prospect|elite|youth|showcase/.test(text);

        if (!hasBaseball) return settle(false, "missing_baseball_context");
        if (!hasCamp && !url.includes("ryzer.com"))
          return settle(false, "missing_camp_context");

        // 2. Intelligent School Match
        const hasSchoolName = text.includes(schoolLower);
        const hasMascot = mascot && text.includes(mascot);
        const hasAlias = aliases.some((a) => text.includes(a));

        if (!hasSchoolName && !hasMascot && !hasAlias) {
          return settle(false, `no_school_match_found`);
        }

        // 3. Contamination check (Bidirectional Mascot Check)
        if (isContaminated(text, schoolName, allSchools, MASCOT_LOOKUP)) {
          return settle(
            false,
            "cross_contaminated_with_rival_school_or_mascot",
          );
        }

        settle(true);
      }
    });

    req.on("error", (e) => settle(false, e.message));
    req.on("timeout", () => {
      req.destroy();
      settle(false, "timeout");
    });
    req.end();
  });
}

async function run() {
  console.log("\n🧠 INTELLIGENT ALIAS-MATCHING AUDIT");
  console.log("=====================================\n");

  let broken = 0;
  let healthy = 0;
  let total = data.filter((d) => d.campUrl && d.campUrl !== "TBA").length;

  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    if (!record.campUrl || record.campUrl === "TBA") continue;

    process.stdout.write(
      `    [${healthy + broken + 1}/${total}] Auditing ${record.university}... `,
    );

    const result = await auditUrlContent(record.campUrl, record.university);

    if (result.ok) {
      console.log("✅");
      healthy++;
    } else {
      console.log(`❌ (${result.reason})`);
      record.campUrl = "";
      record.dates = "TBA";
      record.cost = "TBA";
      record.details = `(URL audit failed: ${result.reason}; link removed)`;
      record.isChecked = false;
      record.autoVerified = false;
      record.autoVerifiedPartial = false;
      broken++;
    }

    if ((healthy + broken) % 50 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(
    `\n✅ FINISHED: ${healthy} valid, ${broken} invalid/irrelevant links cleared.`,
  );
}

/**
 * Targeted cleanup for overlapping schools.
 */
function targetedScrub() {
  const overlapping = [
    "Florida",
    "Florida State",
    "North Florida",
    "South Florida",
    "Florida A&M",
    "Florida Atlantic",
    "FIU",
    "Alabama",
    "Alabama State",
    "Alabama A&M",
    "South Alabama",
    "Arkansas",
    "Arkansas State",
    "Arkansas-Pine Bluff",
    "Central Arkansas",
    "Kansas",
    "Kansas State",
    "Mississippi State",
    "Ole Miss",
    "Southern Miss",
    "Mississippi Valley State",
    "Texas",
    "Texas A&M",
    "Texas State",
    "Texas Southern",
    "North Texas",
    "UT Arlington",
    "UTSA",
    "UT Rio Grande Valley",
    "North Carolina",
    "South Carolina",
    "Coastal Carolina",
    "Western Carolina",
    "East Carolina",
    "Tennessee",
    "Tennessee Tech",
    "Middle Tennessee",
    "UT Martin",
    "Georgia",
    "Georgia Tech",
    "Georgia Southern",
    "Georgia State",
    "Louisiana",
    "Louisiana Tech",
    "LSU",
    "ULM",
    "New Orleans",
    "Tulane",
    "State",
    "Saint",
    "State", // Generic keywords
  ];
  let count = 0;
  for (const record of data) {
    if (overlapping.some((o) => record.university === o)) {
      console.log(
        `Force resetting ${record.university} for advanced re-audit...`,
      );
      record.isChecked = false;
      record.scriptVersion = 0;
      count++;
    }
  }
  if (count > 0) fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

targetedScrub(); // Force reset specific schools
run();
