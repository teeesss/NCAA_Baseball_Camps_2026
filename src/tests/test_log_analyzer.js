/**
 * Log Analyzer Test — Scans `smart_extract.log` for systemic anomalies.
 * 
 * Usage: node src/tests/test_log_analyzer.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const LOG_PATH = path.resolve(__dirname, "../../smart_extract.log");

function analyzeLogs() {
  if (!fs.existsSync(LOG_PATH)) {
    console.log("No extraction log found.");
    return;
  }

  const logs = fs.readFileSync(LOG_PATH, "utf8").split("\n");
  
  let totalProcessed = 0;
  let timeouts = 0;
  let blockedBridges = 0;
  let ddgBlocks = 0;
  let successes = 0;
  let failedSchoolMap = new Map();

  let currentSchool = null;

  logs.forEach(line => {
    // Track current school context
    const processMatch = line.match(/Processing: (.*)$/);
    if (processMatch) {
      currentSchool = processMatch[1];
      totalProcessed++;
    }

    if (line.includes("Timeout (")) {
      timeouts++;
      if (currentSchool) {
        failedSchoolMap.set(currentSchool, (failedSchoolMap.get(currentSchool) || 0) + 1);
      }
    }

    if (line.includes("Blocked Contaminated Bridge")) {
      blockedBridges++;
    }

    if (line.includes("SUCCESS")) {
      successes++;
    }

    if (line.includes("ERR_NAME_NOT_RESOLVED") || line.includes("ERR_CONNECTION_TIMED_OUT")) {
        // DNS or network timeout on target sites
    }

    if (line.includes("rate limit") || line.includes("429")) {
        ddgBlocks++;
    }
  });

  console.log("\n--- EXTRACTION LOG ANALYSIS ---");
  console.log(`Schools Processed in Log Window: ${totalProcessed}`);
  console.log(`Successes Logged: ${successes}`);
  console.log(`Timeouts Experienced: ${timeouts}`);
  console.log(`Contaminated Bridges Blocked: ${blockedBridges}`);
  console.log(`Potential Search Engine Rate Limits: ${ddgBlocks}`);
  
  if (failedSchoolMap.size > 0) {
    console.log("\nTop Timeouting / Failing Schools:");
    [...failedSchoolMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([school, count]) => {
        if (count > 1) {
            console.log(`  - ${school}: failed ${count} times in this log window.`);
        }
      });
  }
}

analyzeLogs();
