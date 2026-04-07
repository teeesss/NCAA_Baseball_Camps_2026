/**
 * fix_price_violations.js
 *
 * Surgical fixes for the 13 price violations identified by test_price_integrity.js
 * Based on manual browser crawl verification on 2026-04-07.
 *
 * Run: node src/utils/fix_price_violations.js
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
let data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// Backup
const backup = DATA_FILE.replace(".json", `_backup_pricefix_${Date.now()}.json`);
fs.copyFileSync(DATA_FILE, backup);
console.log(`📦 Backup: ${path.basename(backup)}\n`);

const NOW = Date.now();
const TODAY = new Date().toISOString();

function findSchool(name) {
  const lower = name.toLowerCase();
  return data.find(d => d.university.toLowerCase() === lower);
}

let changes = 0;

// ════════════════════════════════════════════════════════════════════════════
// GROUP 1: PURGE — No 2026 Data (confirmed by manual browse)
// ════════════════════════════════════════════════════════════════════════════

const PURGE_NO_DATA = [
  {
    school: "Texas Southern University",
    reason: "All pages (index, high-school-showcase, register) show 2025 data only. No 2026 content.",
    previousUrl: "https://www.texassouthernbaseballcamps.com/index.cfm",
  },
  {
    school: "Western Michigan University",
    reason: "wmubaseballcamps.com: 'No events'. wmuevents.com: no baseball content.",
    previousUrl: "https://www.wmubaseballcamps.com",
  },
  {
    school: "Metropolitan State University of Denver",
    reason: "allamericanacademybaseball.com: no events page and no 2026 data.",
    previousUrl: "https://www.allamericanacademybaseball.com/",
  },
];

// Also try alternate name forms for Texas Southern
const TX_SOUTHERN_ALIASES = ["texas southern university", "texas southern"];

for (const item of PURGE_NO_DATA) {
  let record = findSchool(item.school);
  if (!record && item.school.toLowerCase().includes("texas southern")) {
    record = data.find(d => TX_SOUTHERN_ALIASES.some(a => d.university.toLowerCase() === a));
  }
  if (!record) {
    console.log(`⚠️  Not found: ${item.school}`);
    continue;
  }
  console.log(`🗑️  PURGE (no 2026 data): ${record.university}`);
  console.log(`   ${item.reason}`);
  record.campTiers     = [];
  record.dates         = "TBA";
  record.cost          = "TBA";
  record.campUrl       = null;
  record.sourceUrl     = null;
  record.auditStatus   = `NO_DATA_2026 — ${item.reason}`;
  record.isChecked     = false;
  record.scriptVersion = 0;
  record.lastUpdateDate = NOW;
  changes++;
  console.log();
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP 2: PURGE — Third-Party / Wrong-Context Records
// ════════════════════════════════════════════════════════════════════════════

// Slippery Rock: ryzer page is "Messer Baseball LLC Unsigned Showcase" — NOT the
// university's own camp. It's a third-party showcase for unsigned seniors/JC/transfer
// portal players. Real prices are $215/$294 but it's not SRU's camp program.
const sru = data.find(d => d.university.toLowerCase().includes("slippery rock"));
if (sru) {
  console.log(`🗑️  PURGE (3rd-party showcase): ${sru.university}`);
  console.log(`   ryzer.com event is "Messer Baseball LLC Unsigned Showcase" — not SRU's own camp.`);
  console.log(`   Engine extracted only the fee breakdown ($15/$19/$20), missing real prices ($215/$294).`);
  sru.campTiers     = [];
  sru.dates         = "TBA";
  sru.cost          = "TBA";
  sru.campUrl       = null;
  sru.sourceUrl     = null;
  sru.auditStatus   = "THIRD_PARTY_SHOWCASE — Messer Baseball LLC event at SRU, not university-run camp";
  sru.isChecked     = false;
  sru.scriptVersion = 0;
  sru.lastUpdateDate = NOW;
  changes++;
  console.log();
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP 3: FIX — Gonzaga (real data, real portal, youth-focused)
// ════════════════════════════════════════════════════════════════════════════
// zagsbaseballcamps.com/shop/EVENT IS a legitimate registration portal.
// The $50 "Pups" camp is real — it's for ages 4-6 (youngest tier).
// No individual HS prospect camp posted yet. Team camps ($1,500) are sold out.

const gonzaga = data.find(d => d.university.toLowerCase().includes("gonzaga"));
if (gonzaga) {
  console.log(`✏️  FIX: ${gonzaga.university}`);
  console.log(`   Verified via browser: zagsbaseballcamps.com/shop/EVENT is real.`);
  console.log(`   $50 = "Pups Camp" ages 4-6. Legitimate youth tier. No HS prospect camp posted yet.`);
  gonzaga.campTiers = [
    { name: "Helena Future Zags Camp",    dates: "June 22-23, 2026", cost: "$125", ageGroup: "Ages 6-13" },
    { name: "Pups Camp #1",               dates: "July 1-2, 2026",   cost: "$50",  ageGroup: "Ages 4-6"  },
    { name: "Lil Zags Camp #1",           dates: "July 1-2, 2026",   cost: "$125", ageGroup: "Ages 6-10" },
    { name: "Big Dogs Camp #1",           dates: "July 7-8, 2026",   cost: "$140", ageGroup: "Ages 10-14"},
    { name: "Pups Camp #2",               dates: "July 14-15, 2026", cost: "$50",  ageGroup: "Ages 4-6"  },
    { name: "Lil Zags Camp #2",           dates: "July 14-15, 2026", cost: "$125", ageGroup: "Ages 6-10" },
    { name: "Big Dogs Camp #2",           dates: "July 14-15, 2026", cost: "$140", ageGroup: "Ages 10-14"},
    { name: "Advanced Skills Camp",        dates: "July 21-22, 2026", cost: "$140", ageGroup: "Ages 10-14"},
    { name: "Midsummer Classic 18U Team", dates: "June 25-28 / July 16-19, 2026", cost: "$1,500", ageGroup: "18U Teams — SOLD OUT"},
    { name: "Midsummer Classic 16U Team", dates: "July 9-12, 2026",  cost: "$1,500", ageGroup: "16U Teams — SOLD OUT"},
  ];
  gonzaga.dates    = "June 22-23, July 1-2, July 7-8, July 14-15, July 21-22, 2026";
  gonzaga.cost     = "$50 - $1,500";
  gonzaga.campUrl  = "http://www.zagsbaseballcamps.com/shop/EVENT";
  gonzaga.sourceUrl = "http://www.zagsbaseballcamps.com/shop/EVENT";
  gonzaga.email    = "harmonb@gonzaga.edu";
  gonzaga.pointOfContact = "Brandon Harmon (Associate Head Coach)";
  if (!gonzaga.contact || !gonzaga.contact.includes("harmonb")) {
    gonzaga.contact = `Brandon Harmon | harmonb@gonzaga.edu`;
  }
  gonzaga.auditStatus   = "VERIFIED_BROWSER_20260407 — Youth camps confirmed. No HS prospect camp posted yet.";
  gonzaga.isChecked     = true;
  gonzaga.scriptVersion = 10;
  gonzaga.isVerified    = true;
  gonzaga.lastUpdateDate = NOW;
  gonzaga.datesUpdateDate = TODAY;
  gonzaga.priceUpdateDate = TODAY;
  gonzaga.contactUpdateDate = TODAY;
  changes++;
  console.log();
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP 4: FIX — Southwestern Oklahoma State (all camps confirmed real)
// ════════════════════════════════════════════════════════════════════════════
// zacksaundersbaseballcamps.com — crawled all 4 sub-pages.
// $90 camps are real (Hitting/Pitching, ages 7-12, $80 + $10 fees).
// Also found Junior High Camp (grades 7-8) at $122 via ryzer.

const swosu = data.find(d =>
  d.university.toLowerCase().includes("southwestern oklahoma")
);
if (swosu) {
  console.log(`✏️  FIX: ${swosu.university}`);
  console.log(`   Verified via browser: all 4 camp pages have real 2026 data.`);
  swosu.campTiers = [
    { name: "Junior High Camp (Prospect Prep)", dates: "May 25-27, 2026", cost: "$122", ageGroup: "Grades 7-8 (Ages 13-15)" },
    { name: "Fundamentals Camp",                dates: "June 1-4, 2026",  cost: "$138", ageGroup: "Ages 6-12" },
    { name: "Hitting Camp",                     dates: "June 1-2, 2026",  cost: "$90",  ageGroup: "Ages 7-12" },
    { name: "Pitching Camp",                    dates: "June 3-4, 2026",  cost: "$90",  ageGroup: "Ages 8-12" },
  ];
  swosu.dates    = "May 25-27, June 1-4, 2026";
  swosu.cost     = "$90 - $138";
  swosu.campUrl  = "https://www.zacksaundersbaseballcamps.com/";
  swosu.sourceUrl = "https://www.zacksaundersbaseballcamps.com/hitting-camp.cfm";
  swosu.auditStatus   = "VERIFIED_BROWSER_20260407 — All 4 camp pages confirmed real 2026 data";
  swosu.isChecked     = true;
  swosu.scriptVersion = 10;
  swosu.isVerified    = true;
  swosu.lastUpdateDate = NOW;
  swosu.datesUpdateDate = TODAY;
  swosu.priceUpdateDate = TODAY;
  changes++;
  console.log();
}

// ════════════════════════════════════════════════════════════════════════════
// GROUP 5: FLAG — Lubbock Christian (youth-only, no HS camp confirmed)
// ════════════════════════════════════════════════════════════════════════════
// lcubaseballcamps.com has dates/prices but only for Grades 2-6.
// This is a youth camp — not a HS prospect camp. Flagging for re-check.

const lcu = data.find(d => d.university.toLowerCase().includes("lubbock christian"));
if (lcu) {
  console.log(`🚩  FLAG (youth-only): ${lcu.university}`);
  console.log(`   lcubaseballcamps.com shows prices but only for Grades 2-6.`);
  console.log(`   Not a HS prospect camp. Flagging for manual review.`);
  lcu.auditStatus = "PRICE_CHECK_NEEDED — lcubaseballcamps.com is youth-only (Grades 2-6). No HS camp confirmed.";
  lcu.cost        = "TBA"; // Clear suspicious price until HS camp is confirmed
  if (lcu.campTiers) {
    lcu.campTiers.forEach(t => { if (t.cost === "$59") t.cost = "TBA"; });
  }
  lcu.lastUpdateDate = NOW;
  changes++;
  console.log();
}

// ════════════════════════════════════════════════════════════════════════════
// SAVE
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log(`\n═══════════════════════════════════════════════`);
console.log(`📊 Done. ${changes} records updated.`);
console.log(`   Re-run: node src/tests/test_price_integrity.js`);
console.log(`   Then:   npm run generate:dev && npm run deploy:dev`);
console.log(`═══════════════════════════════════════════════`);
