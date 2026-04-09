const fs = require("fs");
const path = require("path");
const https = require("https");
const { getMascot, getUniversityAliases } = require("./mascot_lookup");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = require(DATA_FILE);

function isRealisticName(name) {
  if (!name || name.length > 25 || name.length < 5) return false;
  // Blacklist common roles that aren't names
  const blacklist = ["Pitching Coach", "Assistant Coach", "Associate Coach", "Hitting Coach", "Recruiting Coordinator", "Baseball Coach", "Sun Devils", "Gamecocks", "Razorbacks", "Tar Heels", "Blue Devils", "Volunteers", "Wolfpack", "Longhorns", "Aggies", "Trojans", "Bruins", "Ducks", "Beavers"];
  if (blacklist.some(b => name.toLowerCase().includes(b.toLowerCase()))) return false;
  
  return /^[A-Z][a-z\.\']+(?:\s+[A-Z][a-z\.\']+)+/.test(name);
}

function parseSnippetForName(text, university) {
  const aliases = getUniversityAliases(university);
  const mascot = getMascot(university).toLowerCase();
  const lowerText = text.toLowerCase();
  
  // High-fidelity requirement 1: Snippet MUST mention the school or mascot
  const mentionsSchool = aliases.some(a => lowerText.includes(a.toLowerCase())) || lowerText.includes(mascot);
  if (!mentionsSchool) return null;

  // High-fidelity requirement 2: Snippet SHOULD be recent context
  const isRecent = lowerText.includes("2026") || lowerText.includes("2025");
  if (!isRecent) return null;

  // Exclude legacy/former context explicitly
  if (lowerText.includes("former") || lowerText.includes("legend") || lowerText.includes("retired") || 
      lowerText.includes("alum") || lowerText.includes("grad") || lowerText.includes("graduated") || 
      lowerText.includes("graduate")) return null;

  // Helper for exactly 2-word capitalized names
  const namePattern = "([A-Z][a-z\\']+\\s+[A-Z][a-z\\']+)";

  // Strict check: Snippet must contain university name AND the coach/name pattern
  // Pattern 1: "[Name] is the current head coach"
  let m = text.match(new RegExp(namePattern + "\\s+is the current head (?:baseball )?coach", "i"));
  if (m && isRealisticName(m[1].trim())) {
     const name = m[1].trim();
     if (aliases.some(a => text.toLowerCase().includes(a.toLowerCase()))) return name;
  }

  // Pattern 2: "Erik Bakich - Head Coach"
  m = text.match(new RegExp(namePattern + "\\s*[\\-\\(]\\s*Head (?:\\w+ )?Coach", "i"));
  if (m && isRealisticName(m[1].trim())) {
     const name = m[1].trim();
     // Ensure school name is in the same snippet to avoid alumni matching
     if (aliases.some(a => text.toLowerCase().includes(a.toLowerCase()))) return name;
  }

  // Pattern 3: "Head coach: [Name]"
  m = text.match(new RegExp("Head coach:?\\s*" + namePattern, "i"));
  if (m && isRealisticName(m[1].trim())) {
     const name = m[1].trim();
     if (aliases.some(a => text.toLowerCase().includes(a.toLowerCase()))) return name;
  }
  
  // Pattern 4: roster style "Erik Bakich Head Coach"
  m = text.match(new RegExp(namePattern + "\\s+Head Coach", "i"));
  if (m && isRealisticName(m[1].trim())) {
     const name = m[1].trim();
     if (aliases.some(a => text.toLowerCase().includes(a.toLowerCase()))) return name;
  }

  return null;
}

function fetchDDG(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  return new Promise((resolve) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        // Extract inner text from `.result__snippet` class divs roughly
        const snippets = [];
        const regex = /class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = regex.exec(body)) !== null) {
          // Remove HTML tags strictly
          snippets.push(match[1].replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim());
        }
        resolve(snippets);
      });
    }).on("error", () => resolve([]));
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  let missing = data.filter((d) => !d.headCoach || d.headCoach === "N/A" || d.headCoach === "(none/TBA)");
  
  console.log(`[DDG-HTTPS-Coach] Running full recovery on ${missing.length} programs missing head coaches.`);

  for (let i = 0; i < missing.length; i++) {
    const school = missing[i];
    console.log(`\n[${i + 1}/${missing.length}] Searching for: ${school.university}`);
    
    const mascot = getMascot(school.university);
    const query = `"${school.university}" ${mascot} baseball head coach roster staff 2025 2026`;
    const snippets = await fetchDDG(query);
    
    let extractedName = null;
    for (const text of snippets) {
      extractedName = parseSnippetForName(text, school.university);
      if (extractedName) break;
    }

    if (extractedName) {
      console.log(`   → ✅ Found via DDG API: ${extractedName}`);
      school.headCoach = extractedName;
      school.contactUpdateDate = new Date().toISOString();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    } else {
      console.log(`   → ❌ Not found in DDG snippets.`);
    }
    await delay(2000); // Friendly pacing
  }
  console.log(`\n[DDG-HTTPS-Coach] Trial complete.`);
}
run();
