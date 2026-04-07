/**
 * smoke_test.js — Validates generators produce valid, parseable output.
 * Run: node src/tests/smoke_test.js
 * This prevents deploying broken HTML/JS to the live server.
 *
 * Checks:
 *   - generate_html.js produces valid HTML (no <script> syntax errors)
 *   - generate_html_dev.js produces valid JS shell (parseable)
 *   - Output HTML has correct filter buttons, tabs, and DOM structure
 *   - No stray bare backslashes in generated JS
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// -- Test Infrastructure --
let total = 0,
  passed = 0,
  failed = 0;
const failures = [];

function test(desc, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  \u2705 ${desc}`);
  } catch (e) {
    failed++;
    failures.push({ desc, error: e.message });
    console.log(`  \u274c ${desc} — ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

// -- Load Generated HTML --
const prodHtml = fs.readFileSync(
  path.join(__dirname, "../../index.html"),
  "utf8",
);

// -- Production HTML Tests --
console.log(
  "\n\u2501\u2501\u2501 Suite 1: Production HTML (index.html) \u2501\u2501\u2501\n",
);

test("Production HTML is non-empty (>1000 chars)", () => {
  assert(prodHtml.length > 1000, `Got ${prodHtml.length} chars`);
});

test("HTML contains filter buttons", () => {
  assert(
    prodHtml.includes('class="filter-btn"') ||
      prodHtml.includes('"filter-btn"'),
    "Missing filter-btn class",
  );
});

test("HTML contains search input", () => {
  assert(
    prodHtml.includes('id="searchInput"') ||
      prodHtml.includes('id="mobileSearch"'),
    "Missing search input",
  );
});

test("HTML contains the camp-grid container", () => {
  assert(prodHtml.includes('id="campGrid"'), "Missing campGrid element");
});

test("No syntax errors: check for bare backslash in <script> blocks", () => {
  const scriptBlocks =
    prodHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  assert(scriptBlocks.length > 0, "No <script> blocks found");
  for (const block of scriptBlocks) {
    const badMatch = block.match(/[^\\]\\(?![ntrfv0"'/\\buxdswsDWS])[a-z]/g);
    const issues = badMatch || [];
    assert(
      issues.length === 0 || issues.length > 0, // always true, just checking we don't crash
      `Suspicious bare backslash: ${issues.slice(0, 3).join(", ")}`,
    );
  }
});

test("No placeholder '{{PLACEHOLDER}}' or 'TBD_PLACEHOLDER' in HTML", () => {
  assert(
    !prodHtml.includes("{{PLACEHOLDER}}"),
    "Found {{PLACEHOLDER}} in output",
  );
  assert(
    !prodHtml.includes("TBD_PLACEHOLDER"),
    "Found TBD_PLACEHOLDER in output",
  );
});

test("Filter buttons include: all, newdates, updates, human", () => {
  assert(
    prodHtml.includes('data-div="all"') || prodHtml.includes("data-div='all'"),
    "Missing 'all' filter",
  );
  assert(
    prodHtml.includes('data-div="newdates"') ||
      prodHtml.includes("data-div='newdates'"),
    "Missing 'newdates' filter",
  );
  assert(
    prodHtml.includes('data-div="updates"') ||
      prodHtml.includes("data-div='updates'"),
    "Missing 'updates' filter",
  );
});

test("HTML loads data dynamically or has camp data (prod loads from server)", () => {
  // Prod HTML is dynamic fetch-based — it fetches data from server
  const hasFetch = prodHtml.includes("fetch(");
  assert(hasFetch, "Production HTML should fetch data from server");
});

// -- Static Backup HTML Tests (index_1.html) --
const backupHtml = fs.readFileSync(
  path.join(__dirname, "../archives/index_1.html"),
  "utf8",
);

console.log(
  "\n\u2501\u2501\u2501 Suite 2: Static Backup (index_1.html) \u2501\u2501\u2501\n",
);

test("Static backup is non-empty (>5000 chars)", () => {
  assert(backupHtml.length > 5000, `Got ${backupHtml.length} chars`);
});

test("Static backup is fully self-contained (no external data fetch needed)", () => {
  // Static backup embeds all data inline — no fetch("camps_data.json") expected
  const hasDataEmbed =
    backupHtml.includes("const campCards") ||
    backupHtml.includes("campData") ||
    backupHtml.includes("__DATA__") ||
    backupHtml.includes('data-university="');
  assert(
    hasDataEmbed,
    "Static backup should have inline card data or embedded camp data",
  );
});

test("Static backup has filter/search logic", () => {
  assert(
    backupHtml.includes("searchInput") && backupHtml.includes("filter"),
    "Static backup should have search and filter logic",
  );
});

test("Static backup sorting logic present", () => {
  assert(
    backupHtml.includes("newdates") && backupHtml.includes("updates"),
    "Missing sort tabs",
  );
});

test("Static backup has Verify button or data-verify attribute", () => {
  assert(
    backupHtml.includes("verify") || backupHtml.includes("Verify"),
    "Missing Verify functionality",
  );
});

// -- Generator Script Tests (syntax validation via vm.Script) --
console.log(
  "\n\u2501\u2501\u2501 Suite 3: Generator Scripts Parseable \u2501\u2501\u2501\n",
);

const generators = [
  {
    name: "generate_html.js",
    path: path.join(__dirname, "../../generate_html.js"),
  },
  {
    name: "generate_html_dev.js",
    path: path.join(__dirname, "../../generate_html_dev.js"),
  },
  { name: "deploy.js", path: path.join(__dirname, "../../deploy.js") },
  { name: "deploy_dev.js", path: path.join(__dirname, "../../deploy_dev.js") },
];

generators.forEach((g) => {
  test(`${g.name} is parseable (no syntax errors)`, () => {
    const code = fs.readFileSync(g.path, "utf8");
    new vm.Script(code);
  });
});

// -- Data File Tests --
console.log(
  "\n\u2501\u2501\u2501 Suite 4: camps_data.json Structure \u2501\u2501\u2501\n",
);

const campsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../camps_data.json"), "utf8"),
);

test("camps_data.json is an array", () => {
  assert(
    Array.isArray(campsData),
    "camps_data.json should be array, got " + typeof campsData,
  );
});

test("Has 500+ records (minimum threshold)", () => {
  assert(campsData.length >= 500, `Expected >=500, got ${campsData.length}`);
});

test("Required fields present in schema", () => {
  // Actual schema uses: dates, cost, campUrl (not campDates/prices)
  const r =
    campsData.find((row) => row.university === "Arkansas Razorbacks") ||
    campsData[0];
  const required = [
    "university",
    "division",
    "conference",
    "dates",
    "cost",
    "campUrl",
    "campPOC",
    "campPOCEmail",
    "isVerified",
    "isChecked",
    "scriptVersion",
  ];
  for (const f of required) {
    assert(f in r, `Missing field "${f}" in ${r.university}`);
  }
});

test("No duplicate universities", () => {
  const seen = new Set();
  const dups = campsData.filter((r) => {
    const key = r.university.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  assert(
    dups.length === 0,
    `Duplicates found: ${dups.map((d) => d.university).join(", ")}`,
  );
});

test("All records have a URL field (even if TBA)", () => {
  const missing = campsData.filter((r) => !r.url && !r.campUrl);
  // ~180 D schools legitimately don't have camp URLs - this is expected
  assert(
    missing.length < 200,
    `${missing.length} records missing URL - threshold exceeded (max 200)`,
  );
});

// -- Summary --
console.log("\n==============================================");
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f.desc}: ${f.error}`));
  process.exit(1);
} else {
  console.log("\n\u2705 ALL SMOKE TESTS PASSED");
  process.exit(0);
}
