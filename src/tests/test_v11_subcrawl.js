/**
 * test_v11_subcrawl.js — V11 Sub-Crawl Verification Test
 * 
 * Tests the 3 critical school cases:
 *   1. Alcorn State (PlayNSports platform) — must ONLY crawl /organization/alcorn-state/* links
 *   2. Alabama (dedicated domain) — must NOT extract $10 parking/fee price
 *   3. Austin Peay (TotalCamps) — must ONLY crawl /TRAVISJANSSENBASEBALL/* links
 * 
 * Run: node src/tests/test_v11_subcrawl.js
 */

"use strict";
const { runExtraction } = require("../utils/extraction_engine");

(async () => {
  console.log("\n=== V11 SUB-CRAWL TEST ===");
  console.log("Schools: Alcorn State, Alabama, Austin Peay\n");

  await runExtraction({
    schoolFilter: "alcorn state,alabama,austin peay",
    limit: 3,
    forceRequeue: true,
  });

  console.log("\n=== TEST COMPLETE — Review logs above ===");
  console.log("✅ PASS criteria:");
  console.log("  Alcorn State: ONLY playnsports.com/organization/alcorn-state/* sub-links (no generic /sign-up, /for-coaches, etc.)");
  console.log("  Alabama: NO $10 price in campTiers");
  console.log("  Austin Peay: ONLY totalcamps.com/TRAVISJANSSENBASEBALL/* sub-links");
})();
