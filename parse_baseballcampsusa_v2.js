"use strict";

/**
 * Parse school listings from !source_code_baseballcampsusa.com source code.
 * Each school is wrapped in: <div class="listItem"> ... <span class="school"></span> ... <a class="viewSite"> ... </div>
 * We anchor both school name and URL within each div.listItem block to prevent cross-contamination.
 */

const fs = require("fs");
const SRC =
  "x:/NCAA-DivisonI-Baseball-Camps-2026/!source_code_baseballcampsusa.com";
const OUT = "baseballcampsusa_parsed.json";

const html = fs.readFileSync(SRC, "utf8");

// Extract each div.listItem block
const blocks = html.match(
  /<div\s+class="listItem"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g,
);

console.log("Found", blocks?.length || 0, "listItem blocks");

const results = [];
const seen = new Set();
const otherSports = [
  "basketball",
  "softball",
  "soccer",
  "volleyball",
  "football",
  "tennis",
  "swimming",
  "golf",
  "wrestling",
  "lacrosse",
  "track",
];

for (const block of blocks || []) {
  const schoolMatch = block.match(/<span class="school">([^<]+?)<\/span>/i);
  if (!schoolMatch) continue;

  const school = schoolMatch[1].trim();

  // Skip non-baseball entries
  const lower = school.toLowerCase();
  if (otherSports.some((s) => lower.includes(s)) && !lower.includes("baseball"))
    continue;

  const urlMatch = block.match(/<a[^>]+class="viewSite"[^>]+href="([^"]+)"/);
  const urlAltMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*class="viewSite"/);
  const url = (urlMatch || urlAltMatch)?.[1]?.trim();

  if (!url) continue;

  // Skip duplicates
  if (seen.has(school.toLowerCase())) continue;
  seen.add(school.toLowerCase());

  results.push({ school, url });
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log("Extracted", results.length, "baseball camps");
console.log("\nFirst 10:");
results
  .slice(0, 10)
  .forEach((r) => console.log("  " + r.school + " => " + r.url));
