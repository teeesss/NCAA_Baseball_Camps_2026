const fs = require("fs");
const https = require("https");
const http = require("http");
const URL = require("url").URL;
const { search } = require("duckduckgo-search");

const dataFile = "camps_data.json";
let campsData = JSON.parse(fs.readFileSync(dataFile, "utf8"));

// Function to check if a URL is valid (200 OK)
async function verifyUrl(urlStr) {
  if (!urlStr || urlStr === "TBA" || urlStr.trim() === "") return false;

  // Ensure URL has protocol
  if (!urlStr.startsWith("http")) {
    urlStr = "https://" + urlStr;
  }

  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      return resolve(false);
    }

    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      parsed,
      {
        method: "HEAD",
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
      (res) => {
        // Treat 2xx and 3xx as okay (many sites redirect or return 200)
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else if (res.statusCode === 403 || res.statusCode === 401) {
          // Some athletic sites block programmatic HEAD requests, but the site exists
          resolve(true);
        } else {
          resolve(false);
        }
      },
    );

    req.on("error", () => {
      // If HEAD fails, try GET since some servers don't support HEAD properly
      const getReq = lib.request(
        parsed,
        {
          method: "GET",
          timeout: 5000,
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
        },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve(true);
          } else if (res.statusCode === 403 || res.statusCode === 401) {
            resolve(true); // likely exists but firewall blocks bot
          } else {
            resolve(false);
          }
        },
      );
      getReq.on("error", () => resolve(false));
      getReq.on("timeout", () => getReq.destroy());
      getReq.end();
    });

    req.on("timeout", () => {
      req.destroy();
    });

    req.end();
  });
}

const googleIt = require("google-it");

// Function to try to find a URL via Google
async function findUrl(universityName) {
  try {
    const query = `"${universityName}" NCAA baseball athletics official site`;
    const results = await googleIt({ query, disableConsole: true });
    if (results && results.length > 0) {
      // Find the best athletics link
      for (let r of results) {
        if (
          r.link &&
          (r.link.includes("athletics") ||
            r.link.includes("sports") ||
            r.link.endsWith(".edu/") ||
            r.link.includes("ryzer"))
        ) {
          const valid = await verifyUrl(r.link);
          if (valid) return r.link;
        }
      }
      // fallback to first valid link
      for (let r of results) {
        if (!r.link || !r.link.startsWith("http")) continue;
        const valid = await verifyUrl(r.link);
        if (valid) return r.link;
      }
    }
  } catch (e) {
    // console.error(`Search error for ${universityName}:`, e.message);
  }

  // Fallback URL generation pattern removed as per user request to not fake links.
  return null;
}

// Main processing logic
async function processData() {
  let discovered = 0;
  let verifiedOk = 0;
  let failed = 0;

  console.log(`Starting scan of ${campsData.length} records...`);

  const concurrency = 10;
  for (let i = 0; i < campsData.length; i += concurrency) {
    const chunk = campsData.slice(i, i + concurrency);

    const tasks = chunk.map(async (school) => {
      // Apply strict standard whatToBring based on explicit user requirements
      school.whatToBring =
        "Glove, bat, helmet, cleats, baseball pants, water bottle, sunscreen.";

      let isMissing =
        !school.campUrl ||
        school.campUrl === "TBA" ||
        school.campUrl.trim() === "" ||
        school.campUrl ===
          "https://www.ncsasports.org/college-search?query=undefined";
      let urlWorks = false;

      if (!isMissing) {
        urlWorks = await verifyUrl(school.campUrl);
        if (!urlWorks) {
          // Treat broken URL as missing
          isMissing = true;
          school.campUrl = "";
        } else {
          verifiedOk++;
        }
      }

      if (isMissing) {
        const foundUrl = await findUrl(school.university);
        if (foundUrl) {
          school.campUrl = foundUrl;
          discovered++;
          verifiedOk++;
        } else {
          school.campUrl = ""; // Leave strictly blank rather than generic
          failed++;
        }
      }
    });

    await Promise.all(tasks);
    console.log(
      `Processed ${Math.min(i + concurrency, campsData.length)} / ${campsData.length} records...`,
    );
  }

  console.log(`\nScan Complete.`);
  console.log(`Originally Valid / Works: ${verifiedOk - discovered}`);
  console.log(`Newly Discovered & Verified: ${discovered}`);
  console.log(`Still Failed / Missing: ${failed}`);

  fs.writeFileSync(dataFile, JSON.stringify(campsData, null, 2));
  console.log(`\nUpdated ${dataFile}`);
}

processData().catch(console.error);
