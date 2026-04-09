/**
 * smart_extract.js — RUNNER SHELL
 *
 * This file is intentionally thin. It ONLY:
 *  1. Parses command-line arguments
 *  2. Calls runExtraction() from the authoritative engine module
 *
 * ALL extraction logic lives in: src/utils/extraction_engine.js
 * ALL constants live in:         src/utils/config.js
 *
 * DO NOT add extraction logic, regex patterns, search engine selectors,
 * price thresholds, or any other data-processing rules here.
 *
 * Usage:
 *   node smart_extract.js
 *   node smart_extract.js --school="Alabama"
 *   node smart_extract.js --school="SEC" --limit=20
 *   node smart_extract.js --school="Arkansas,Texas A&M" --force
 *   node smart_extract.js --limit=50
 *   node smart_extract.js --force   (reprocess schools that are already isChecked)
 */

"use strict";

const { runExtraction } = require("../utils/extraction_engine");

// ── Parse CLI arguments ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = {};
for (const a of args) {
  const [k, v] = a.replace(/^--/, "").split("=");
  argMap[k] = v || true;
}

const schoolFilter = argMap.school || null; // e.g. "Alabama" or "Alabama,Auburn"
const limit = argMap.limit ? parseInt(argMap.limit, 10) : null;
const forceRequeue = !!argMap.force;

if (forceRequeue)
  console.log(
    "[smart_extract] ⚠️  --force flag set: re-processing already-checked schools.",
  );
if (schoolFilter)
  console.log(`[smart_extract] 🏫  School filter: "${schoolFilter}"`);
if (limit) console.log(`[smart_extract] 🔢  Limit: ${limit} schools`);
console.log("[smart_extract] 🚀  Delegating to extraction_engine.js...\n");

// ── Delegate entirely to the authoritative engine ────────────────────────────
runExtraction({ schoolFilter, limit, forceRequeue })
  .then((res) => {
    if (res && res.batchLimitReached) {
      console.log("[smart_extract] 🛑  Batch processing limit reached. Returning exit code 88 to watchdog.");
      process.exit(88);
    }
    console.log("[smart_extract] ✅  Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[smart_extract] ❌  Fatal error: ${err.message}`);
    process.exit(1);
  });
