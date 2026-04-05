/**
 * fix_missing_logos.js
 * ============================================================
 * Finds all schools in camps_data.json that are missing a
 * logoFile and assigns one using:
 *
 *  1. Hardcoded domain map  (covers Power 5 / well-known programs
 *     that the hipolabs API routinely misses)
 *  2. Clearbit Logo API     (https://logo.clearbit.com/<domain>)
 *  3. Google Favicon API    (sz=128, same as fetch_logos.js)
 *
 * The logo is always a remote URL — no local file download needed.
 * All logos are sized at exactly 32px in the HTML via CSS.
 * ============================================================
 */

"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const DATA_FILE = path.join(__dirname, "camps_data.json");

// ── Hardcoded domain map ─────────────────────────────────────
// Keys are exact university strings from camps_data.json.
// Values are the primary athletics or university domain.
const DOMAIN_OVERRIDE = {
  "Air Force": "goairforcefalcons.com",
  Akron: "gozips.com",
  "Alabama A&M": "aamusports.com",
  "Alabama State": "bamastatesports.com",
  "Appalachian State": "appstatesports.com",
  "Arkansas-Pine Bluff": "uapblionsroar.com",
  Auburn: "auburntigers.com",
  Bellarmine: "bellarmine.edu",
  "Bethune-Cookman": "bcu.edu",
  BYU: "byucougars.com",
  "Cal Poly": "gopoly.com",
  "Cal State Bakersfield": "gocsu.com",
  "Cal State Fullerton": "fullertontitans.com",
  "Cal State Northridge": "gomatadors.com",
  "Central Arkansas": "ucasports.com",
  "Charleston Southern": "csusports.com",
  "Chicago State": "csurams.com",
  Clemson: "clemsontigers.com",
  "Coastal Carolina": "gochanticleers.com",
  Columbia: "gocolumbialions.com",
  Cornell: "cornellbigred.com",
  Creighton: "gocreighton.com",
  Dartmouth: "dartmouthsports.com",
  Davidson: "davidsonwildcats.com",
  Dayton: "daytonflyers.com",
  Delaware: "bluehens.com",
  "Detroit Mercy": "detroitmercy.edu",
  Duke: "goduke.com",
  "East Carolina": "ecupirates.com",
  "Eastern Illinois": "eiupanthers.com",
  "Eastern Kentucky": "ekusports.com",
  "Eastern Michigan": "emueagles.com",
  Elon: "phxsports.com",
  Fairfield: "fairfieldstags.com",
  "Fairleigh Dickinson": "fduknights.com",
  Fordham: "fordhamrams.com",
  "Fresno State": "gobulldogs.com",
  Furman: "furmanpaladins.com",
  "George Mason": "gomason.com",
  Georgetown: "guhoyas.com",
  "Georgia Southern": "gseagles.com",
  "Georgia State": "georgiastatesports.com",
  "Georgia Tech": "ramblinwreck.com",
  Gonzaga: "gozags.com",
  "Grand Canyon": "gculopes.com",
  Harvard: "gocrimson.com",
  Hawaii: "hawaiiathletics.com",
  "High Point": "highpointpanthers.com",
  Hofstra: "hofstrasports.com",
  "Holy Cross": "goholycross.com",
  Houston: "uhcougars.com",
  "Illinois State": "goredbirds.com",
  "Indiana State": "gosycamores.com",
  "Iowa State": "cyclones.com",
  Jacksonville: "jaxdolphins.com",
  "Jacksonville State": "jsugamecocksports.com",
  "James Madison": "jmusports.com",
  "Kansas State": "kstatesports.com",
  "Kennesaw State": "ksuowls.com",
  "Kent State": "kentstatesports.com",
  "La Salle": "goexplorers.com",
  Lamar: "lamarcardinals.com",
  Lehigh: "lehighsports.com",
  Liberty: "libertyflamessports.com",
  Lipscomb: "lipscombsports.com",
  "Long Beach State": "longbeachstate.com",
  "Long Island University": "liuathletics.com",
  Louisiana: "ragincajuns.com",
  "Louisiana Tech": "latechsports.com",
  Louisville: "gocards.com",
  "Loyola Marymount": "lmulions.com",
  Maine: "umaineathletics.com",
  Manhattan: "gojaspers.com",
  Marist: "goredfoxes.com",
  Marshall: "herdzone.com",
  Maryland: "umterps.com",
  "McNeese State": "mcneesesports.com",
  Mercer: "mercerbears.com",
  Merrimack: "merrimackathletics.com",
  "Miami (FL)": "hurricanesports.com",
  "Miami (OH)": "muredhawks.com",
  "Michigan State": "msuspartans.com",
  Minnesota: "gophersports.com",
  "Mississippi State": "mstateathletics.com",
  Missouri: "mutigers.com",
  "Missouri State": "missouristatebears.com",
  Monmouth: "monmouthhawks.com",
  "Mount St. Mary's": "mountathletics.com",
  "Murray State": "goracers.com",
  Navy: "navysports.com",
  Nebraska: "huskers.com",
  Nevada: "nevadawolfpack.com",
  "New Mexico": "golobos.com",
  "New Mexico State": "nmstatesports.com",
  "New Orleans": "privateersnola.com",
  Niagara: "purpleeagles.com",
  "Nicholls State": "nicholls.edu",
  "Norfolk State": "nsuathletics.com",
  "North Carolina A&T": "ncatasports.com",
  "North Carolina Central": "nccu.edu",
  "North Dakota": "undsports.com",
  "North Dakota State": "gobison.com",
  "North Florida": "unfosprey.com",
  Northeastern: "nuhuskies.com",
  "Northern Colorado": "uncbears.com",
  "Northern Illinois": "niuhuskies.com",
  "Northern Iowa": "unipanthers.com",
  "Northern Kentucky": "nkunorsemen.com",
  Northwestern: "nusports.com",
  "Northwestern State": "nsudemons.com",
  "Notre Dame": "und.com",
  Oakland: "goldengrizzlies.com",
  Ohio: "ohiobobcats.com",
  "Ohio State": "ohiostatebuckeyes.com",
  Oklahoma: "soonersports.com",
  "Oklahoma State": "okstate.com",
  "Old Dominion": "odusports.com",
  "Oral Roberts": "oruathletics.com",
  Penn: "pennathletics.com",
  "Penn State": "gopsusports.com",
  Pepperdine: "pepperdinewaves.com",
  Pittsburgh: "pittsburghpanthers.com",
  Portland: "portlandpilots.com",
  "Portland State": "goviks.com",
  "Prairie View A&M": "pvpanthersports.com",
  Presbyterian: "gopcathletics.com",
  Princeton: "princetontiger.com",
  Purdue: "purduesports.com",
  "Purdue Fort Wayne": "pfwathletics.com",
  Quinnipiac: "quinnipiacbobcats.com",
  Radford: "radfordhighlanders.com",
  "Rhode Island": "gorhody.com",
  Rice: "riceowls.com",
  Rider: "gobroncs.com",
  "Robert Morris": "rmucolonials.com",
  "Sacred Heart": "sacredheartpioneers.com",
  "Saint Joseph's": "sjuhawks.com",
  "Saint Louis": "slubillikens.com",
  "Sam Houston State": "samhoustonbearkats.com",
  Samford: "samfordsports.com",
  "San Diego": "usdtoreros.com",
  "San Diego State": "goaztecs.com",
  "Santa Clara": "santaclarabroncos.com",
  "Seton Hall": "shupirates.com",
  Siena: "sienasaints.com",
  "South Carolina State": "scstatebuddies.com",
  "South Dakota": "goyotes.com",
  "South Dakota State": "gojacks.com",
  "Southeastern Louisiana": "lionsports.net",
  "Southern Illinois": "siusalukis.com",
  "Southern Illinois Edwardsville": "siuecougars.com",
  "Southern Miss": "southernmiss.com",
  "Southern University": "suathletics.com",
  "St. John's": "redstormsports.com",
  "Stony Brook": "goseawolves.com",
  Syracuse: "cuse.com",
  Tampa: "ut.edu",
  Temple: "owlsports.com",
  "Tennessee State": "tsutigers.com",
  "Tennessee Tech": "ttusports.com",
  "Texas A&M-Corpus Christi": "goislanders.com",
  "Texas Southern": "txsotiger.com",
  "Texas State": "txstatebobcats.com",
  Toledo: "utrockets.com",
  Troy: "troytrojans.com",
  Tulane: "tulanegreenwave.com",
  Tulsa: "tulsahurricane.com",
  "UC Davis": "ucdavisaggies.com",
  "UC Irvine": "ucirvinesports.com",
  "UC Riverside": "ucrhighlanders.com",
  "UC San Diego": "ucsdtritons.com",
  "UC Santa Barbara": "ucsbgauchos.com",
  UCF: "ucfknights.com",
  UCSB: "ucsbgauchos.com",
  UMass: "umassmintues.com",
  "UMass Lowell": "riverhawksports.com",
  "UNC Wilmington": "uncwsports.com",
  UNLV: "unlvrebels.com",
  "UT Arlington": "utamavs.com",
  "UT Martin": "utmsports.com",
  UTEP: "utepminers.com",
  UTRGV: "utrgvathletics.com",
  UTSA: "utsaroadrunners.com",
  "Utah Valley": "utahvalleywolverines.com",
  Vanderbilt: "vucommodores.com",
  Vermont: "uvmathletics.com",
  Villanova: "villanova.com",
  VMI: "vmikeydets.com",
  Wagner: "wagnerathletics.com",
  "Wake Forest": "wakeforestsports.com",
  Washington: "gohuskies.com",
  "Washington State": "wsucougars.com",
  "West Virginia": "wvusports.com",
  "Western Carolina": "catamountsports.com",
  "Western Illinois": "goleathernecks.com",
  "Western Kentucky": "wkusports.com",
  "Western Michigan": "wmubroncos.com",
  "William & Mary": "tribeathletics.com",
  Winthrop: "winthropeagles.com",
  Wofford: "woffordterriers.com",
  "Wright State": "wsuraiders.com",
  Wyoming: "gocowboys.com",
  Xavier: "goxavier.com",
  Yale: "yalebulldogs.com",
  "Youngstown State": "ysusports.com",
};

// ── Helpers ──────────────────────────────────────────────────
function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          method: "HEAD",
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname,
          timeout: 6000,
        },
        (res) => resolve(res.statusCode < 400),
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch (_) {
      resolve(false);
    }
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────
async function run() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const missing = data.filter((s) => !s.logoFile || s.logoFile === "");

  console.log(
    `🔍 Found ${missing.length} schools missing logos. Processing...\n`,
  );

  let fixed = 0;
  let skipped = 0;

  for (const school of missing) {
    const uni = school.university;

    // Priority 1: Hardcoded override
    let domain = DOMAIN_OVERRIDE[uni] || null;

    // Priority 2: Extract domain from existing campUrl if it's a school site
    if (!domain && school.campUrl && school.campUrl.startsWith("http")) {
      try {
        const parsed = new URL(school.campUrl);
        const host = parsed.hostname.replace(/^www\./, "");
        // Only trust .edu, goXXX.com, XXXathletics.com, XXXsports.com patterns
        if (
          host.endsWith(".edu") ||
          /go[a-z]+\.com$/.test(host) ||
          /athletics\.com$/.test(host) ||
          /sports\.com$/.test(host)
        ) {
          domain = host;
        }
      } catch (_) {}
    }

    // Priority 3: hipolabs lookup (cheap HTTP, no puppeteer)
    if (!domain) {
      try {
        const searchName = uni
          .replace(/ University| College| State$/gi, "")
          .replace(/&/g, "and")
          .trim();
        const res = await new Promise((resolve) => {
          http
            .get(
              `http://universities.hipolabs.com/search?name=${encodeURIComponent(searchName)}&country=United+States`,
              (r) => {
                let d = "";
                r.on("data", (c) => (d += c));
                r.on("end", () => {
                  try {
                    resolve(JSON.parse(d));
                  } catch (_) {
                    resolve(null);
                  }
                });
              },
            )
            .on("error", () => resolve(null));
        });
        if (res && res.length > 0) {
          const best =
            res.find((r) => r.name.toLowerCase().includes(uni.toLowerCase())) ||
            res[0];
          if (best && best.domains && best.domains.length > 0)
            domain = best.domains[0];
        }
      } catch (_) {}
    }

    if (!domain) {
      console.log(`  ⏭  ${uni}: no domain found — skipping`);
      skipped++;
      continue;
    }

    // Build logo URL — try Clearbit first (higher quality), then Google Favicon
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    const clearbitOk = await checkUrl(clearbitUrl);
    school.logoDomain = domain;
    school.logoFile = clearbitOk ? clearbitUrl : faviconUrl;

    console.log(
      `  ✅ ${uni}: ${clearbitOk ? "Clearbit" : "Favicon"} → ${school.logoFile}`,
    );
    fixed++;

    // If campUrl is still missing, set the university domain as fallback
    if (!school.campUrl || school.campUrl === "TBA" || school.campUrl === "") {
      school.campUrl = `https://www.${domain}`;
    }

    // Throttle to avoid rate limiting
    await sleep(150);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  console.log(`\n✅ Done!`);
  console.log(`   Fixed:   ${fixed} / ${missing.length}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Run: node generate_html.js to rebuild index.html\n`);
}

run().catch(console.error);
