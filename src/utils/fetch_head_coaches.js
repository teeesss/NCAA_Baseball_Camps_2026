/**
 * Fetch head coaches for NCAA baseball programs via Wikipedia
 * Whitelisted for Wikipedia only — writes headCoach to camps_data.json
 *
 * Strategy: Search "{school} baseball head coach" → first result is often the coach's Wikipedia page.
 * Extract the name from the page title, NOT from text extraction.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function wikiSearch(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&srnamespace=0`;
  return new Promise((resolve) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "NCAA-Baseball-Camps-Bot/1.0" } },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body).query?.search || []);
            } catch {
              resolve([]);
            }
          });
        },
      )
      .on("error", () => resolve([]));
  });
}

// Check if a Wikipedia title looks like a person's name (First Last)
function isPersonName(title) {
  // Person pages: "Brad Bohannon", "Dave Van Horn", "Jim Schlossnagle"
  // NOT: "Kentucky Wildcats baseball", "2023 NCAA Division I baseball tournament"
  const skipPatterns = [
    "baseball",
    "football",
    "basketball",
    "soccer",
    "softball",
    "season",
    "tournament",
    "team",
    "conference",
    "stadium",
    "championship",
    "league",
    "NCAA",
    "NAIA",
    "college",
  ];
  const lower = title.toLowerCase();
  if (skipPatterns.some((p) => lower.includes(p))) return false;
  // Must be two capitalized words (first + last name)
  return /^[A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|II|III|IV|Mac[A-Za-z]+|Mc[A-Za-z]+|O'[A-Za-z]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))+$/.test(
    title,
  );
}

async function findCoachForSchool(schoolName) {
  // Try both search strategies
  const queries = [
    `${schoolName} baseball head coach`,
    `${schoolName} baseball coach`,
  ];

  for (const q of queries) {
    const results = await wikiSearch(q);

    for (const r of results) {
      const title = r.title;

      // Strategy: if the page title is a person's name, that's likely the coach
      if (isPersonName(title)) {
        // Verify snippet mentions "head coach" or "coach"
        const snippet = (r.snippet || "").toLowerCase();
        if (snippet.includes("head coach") || snippet.includes("coach")) {
          return title;
        }
      }
    }

    // Be nice between queries
    await delay(200);
  }

  return null;
}

async function run() {
  let processed = 0,
    found = 0,
    notFound = 0;

  const toProcess = data.filter((s) => !s.headCoach || s.headCoach === "N/A");
  console.log(
    `Starting head coach lookup: ${toProcess.length} of ${data.length} schools need data\n`,
  );

  for (const school of data) {
    if (school.headCoach && school.headCoach !== "N/A") continue;

    processed++;
    try {
      const coach = await findCoachForSchool(school.university);
      if (coach) {
        school.headCoach = coach;
        console.log(`[${processed}] ${school.university} → ✅ ${coach}`);
        found++;
      } else {
        console.log(`[${processed}] ${school.university} → ❌ Not found`);
        notFound++;
      }
    } catch (err) {
      console.log(`[${processed}] ${school.university} → ❌ ${err.message}`);
      notFound++;
    }

    await delay(800);
    if (processed % 25 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`  ... saved progress after ${processed}\n`);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`\n✅ Done: ${found} found, ${notFound} not found`);
}

run();
