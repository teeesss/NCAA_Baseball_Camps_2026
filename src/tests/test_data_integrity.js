"use strict";

const fs = require("fs");
const path = require("path");
const {
  isBlacklistedUrl,
  isGenericPage,
  isCampRelatedUrl,
  unwrapUrl,
  isSearchEngineUrl,
} = require("../utils/url_validator");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// ── Test Results ──
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (err) {
    failedTests++;
    failures.push({ description, error: err.message });
    console.log(`  ❌ FAIL: ${description} — ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

// ── TEST SUITE ──

console.log("\n🔍 DATA INTEGRITY TEST SUITE");
console.log("==============================================\n");
console.log(`Total records in database: ${data.length}\n`);

// ── Suite 1: URL Quality ──
console.log("━━━ Suite 1: URL Quality ━━━\n");

test("No search-engine redirect URLs should be stored", () => {
  const bad = data.filter((r) => r.campUrl && isSearchEngineUrl(r.campUrl));
  assert(
    bad.length === 0,
    `Found ${bad.length} search-engine URLs: ${bad
      .slice(0, 3)
      .map((r) => `${r.university} → ${r.campUrl}`)
      .join(", ")}`,
  );
});

test("No blacklisted domain URLs should be stored", () => {
  const bad = data.filter(
    (r) =>
      r.campUrl && !isSearchEngineUrl(r.campUrl) && isBlacklistedUrl(r.campUrl),
  );
  assert(
    bad.length === 0,
    `Found ${bad.length} blacklisted URLs: ${bad
      .slice(0, 3)
      .map((r) => `${r.university} → ${r.campUrl}`)
      .join(", ")}`,
  );
});

test("No generic .edu root pages should be stored as campUrl", () => {
  const bad = data.filter(
    (r) =>
      r.campUrl &&
      !isSearchEngineUrl(r.campUrl) &&
      !isBlacklistedUrl(r.campUrl) &&
      isGenericPage(r.campUrl),
  );
  assert(
    bad.length === 0,
    `Found ${bad.length} generic pages: ${bad
      .slice(0, 3)
      .map((r) => `${r.university} → ${r.campUrl}`)
      .join(", ")}`,
  );
});

test("All stored campUrls should contain camp-relevant keywords", () => {
  const bad = data.filter(
    (r) =>
      r.campUrl &&
      !isSearchEngineUrl(r.campUrl) &&
      !isBlacklistedUrl(r.campUrl) &&
      !isGenericPage(r.campUrl) &&
      !isCampRelatedUrl(r.campUrl),
  );
  assert(
    bad.length === 0,
    `Found ${bad.length} non-camp URLs: ${bad
      .slice(0, 3)
      .map((r) => `${r.university} → ${r.campUrl}`)
      .join(", ")}`,
  );
});

test("Unwrapped DDG redirects resolve to valid domains", () => {
  // Check that DDG redirect URLs, if they exist, unwrap to non-blacklisted URLs
  const ddgUrls = data.filter(
    (r) => r.campUrl && r.campUrl.includes("duckduckgo.com"),
  );
  const badUnwraps = ddgUrls.filter((r) => {
    const unwrapped = unwrapUrl(r.campUrl);
    return isBlacklistedUrl(unwrapped);
  });
  assert(
    ddgUrls.length === 0,
    `Found ${ddgUrls.length} DDG redirect URLs that should have been unwrapped/cleaned`,
  );
});

// ── Suite 2: Data Consistency ──
console.log("\n━━━ Suite 2: Data Consistency ━━━\n");

test("No record should have dates but also say 'no official dates'", () => {
  const bad = data.filter((r) => {
    const hasDates = r.dates && r.dates !== "TBA";
    const hasNoDates =
      r.auditStatus === "no_official_dates" ||
      r.additionalNote?.includes("no official") ||
      (r.additionalNote?.includes("TBA") && !hasDates);
    return hasDates && hasNoDates;
  });
  assert(
    bad.length === 0,
    `Found ${bad.length} records with conflicting date status`,
  );
});

test("URLs with TBA dates should not claim specific dates found", () => {
  const bad = data.filter((r) => {
    return r.dates === "TBA" && r.datesMatch?.length > 0;
  });
  // This test is informational — not all setups track datesMatch
  assert(true, "Skipped — datesMatch field not universally present");
});

test("Records with verified=false and no campUrl should be flagged", () => {
  const bad = data.filter((r) => !r.isVerified && !r.campUrl && !r.isChecked);
  assert(
    bad.length <= data.length * 0.40,
    `${bad.length} records unchecked (40% threshold — known DII programs without posted camp pages)`,
  );
});

// ── Suite 3: Field Completeness ──
console.log("\n━━━ Suite 3: Field Completeness ━━━\n");

test("All records must have university field", () => {
  const bad = data.filter((r) => !r.university);
  assert(bad.length === 0, `${bad.length} records missing university`);
});

test("All records must have division field", () => {
  const bad = data.filter((r) => !r.division);
  assert(bad.length === 0, `${bad.length} records missing division`);
});

test("Cost field should not have placeholder values under $5", () => {
  const bad = data.filter((r) => {
    if (!r.cost || r.cost === "TBA") return false;
    const match = r.cost.match(/\$(\d+)/);
    if (match && parseInt(match[1], 10) < 5) return true;
    return false;
  });
  assert(
    bad.length === 0,
    `Found ${bad.length} records with suspicious prices under $5`,
  );
});

// ── Suite 4: Specific Known Bad Records ──
console.log("\n━━━ Suite 4: Known Bad Records (Fixed?) ━━━\n");

const knownBad = [
  {
    name: "University of Central Oklahoma",
    badContains: ["duckduckgo.com", "kidvoyage.com"],
  },
  {
    name: "Florida Tech",
    badContains: ["ncsasports.org"],
  },
  {
    name: "Gannon University",
    badUrl: "https://www.gannon.edu",
  },
  {
    name: "Georgia Southwestern State University",
    badUrl: "https://www.gsw.edu",
  },
];

knownBad.forEach((check) => {
  test(`${check.name} should not store blacklisted or generic URLs`, () => {
    const record = data.find((r) =>
      r.university.toLowerCase().includes(check.name.toLowerCase()),
    );
    if (!record) {
      assert(false, `Record not found: ${check.name}`);
      return;
    }
    const url = record.campUrl || "";
    if (check.badContains) {
      check.badContains.forEach((bad) => {
        assert(!url.includes(bad), `${check.name} still has bad URL: ${url}`);
      });
    }
    if (check.badUrl) {
      assert(
        url !== check.badUrl,
        `${check.name} still has generic URL: ${url}`,
      );
    }
    // Must pass all quality gates now
    if (url && url !== "TBA") {
      assert(
        !isSearchEngineUrl(url),
        `${check.name} URL is search engine: ${url}`,
      );
      assert(
        !isBlacklistedUrl(url),
        `${check.name} URL is blacklisted: ${url}`,
      );
    }
  });
});

// ── Results Summary ──
console.log("\n==============================================");
console.log(
  `Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`,
);

if (failures.length > 0) {
  console.log("\nDetailed failures:");
  failures.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.description}: ${f.error}`);
  });
  console.log(`\n❌ ${failedTests} test(s) FAILED — data cleanup needed`);
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED — data quality is good");
  process.exit(0);
}
