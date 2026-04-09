"use strict";

/**
 * Phase 1 of Approach C: Batch-verify playnsports & BCUSA URLs.
 *
 * Checks all URLs in camps_data.json where sourceUrl contains playnsports or baseballcampsusa.
 * Filters out 404s, flags healthy URLs for extraction.
 *
 * Usage: node src/utils/verify_source_urls.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const DATA_FILE = path.join(__dirname, "..", "..", "camps_data.json");
const REPORT_FILE = path.join(
  __dirname,
  "..",
  "debug",
  "url_verification_report_source.json",
);

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// Filter schools from our two sources
const targetSchools = data.filter(
  (s) =>
    (s.sourceUrl || "").includes("playnsports") ||
    (s.sourceUrl || "").includes("baseballcampsusa") ||
    s.auditStatus === "NEW_SOURCE_DETECTED",
);

console.log(`Total schools in database: ${data.length}`);
console.log(`Schools from playnsports/BCUSA sources: ${targetSchools.length}`);

const results = [];
let completed = 0;

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url || url === "TBA" || url === "") {
      resolve({ status: "EMPTY", url: url || "" });
      return;
    }

    const cleanUrl = url.replace(/\/$/, ""); // trailing slash
    try {
      const protocol = cleanUrl.startsWith("https") ? https : http;
      const req = protocol.get(cleanUrl, { timeout: 15000 }, (res) => {
        // Follow redirects - check final statusCode
        resolve({
          status: res.statusCode || res.status,
          url: cleanUrl,
          finalUrl: res.url || cleanUrl,
          headers: {
            "content-type": res.headers["content-type"] || "",
          },
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ status: "TIMEOUT", url: cleanUrl });
      });

      req.on("error", (err) => {
        resolve({
          status: "ERROR",
          url: cleanUrl,
          error: err.message,
        });
      });
    } catch (e) {
      resolve({ status: "ERROR", url: cleanUrl, error: e.message });
    }
  });
}

async function verifyAll() {
  const startTime = Date.now();

  for (const school of targetSchools) {
    completed++;
    const url = school.campUrl || school.url || "";
    const result = await checkUrl(url);

    result.university = school.university;
    result.division = school.division;
    result.auditStatus = school.auditStatus || "unknown";

    results.push(result);

    const status = result.status === 200 ? "200" : result.status;
    console.log(
      `[${completed}/${targetSchools.length}] ${school.university} -> ${url} (${status})`,
    );

    // Don't hammer servers - be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  // Summarize
  const ok200 = results.filter((r) => r.status === 200);
  const redirects = results.filter(
    (r) => typeof r.status === "number" && r.status >= 300 && r.status < 400,
  );
  const notFound = results.filter(
    (r) => r.status === 404 || r.status === "EMPTY",
  );
  const errors = results.filter(
    (r) => r.status === "ERROR" || r.status === "TIMEOUT",
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(`Total checked: ${results.length}`);
  console.log(`✅ 200 OK: ${ok200.length}`);
  console.log(`↩️ Redirects (3xx): ${redirects.length}`);
  console.log(`❌ 404/Empty: ${notFound.length}`);
  console.log(`⚠️ Errors/Timeouts: ${errors.length}`);
  console.log(`Time: ${elapsed}s`);

  if (notFound.length > 0) {
    console.log("\n=== 404/EMPTY URLs ===");
    for (const n of notFound) {
      console.log(`  ${n.university}: ${n.url}`);
    }
  }

  if (errors.length > 0) {
    console.log("\n=== ERRORS/TIMEOUTS ===");
    for (const e of errors) {
      console.log(`  ${e.university}: ${e.url} (${e.error || "timeout"})`);
    }
  }

  // Save report
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport saved to: ${REPORT_FILE}`);

  // Update camps_data.json with verification status
  const reportMap = {};
  for (const r of results) {
    reportMap[r.university] = r;
  }

  let updated = 0;
  for (const school of data) {
    if (!reportMap[school.university]) continue;
    const report = reportMap[school.university];
    if (
      report.status === 200 ||
      (typeof report.status === "number" &&
        report.status >= 300 &&
        report.status < 400)
    ) {
      updated++;
    } else {
      school.auditStatus = "URL_404";
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Updated ${updated} schools with auditStatus in camps_data.json`);
}

verifyAll().catch(console.error);
