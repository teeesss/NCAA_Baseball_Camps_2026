# smart_extract.js Fixes (2026-04-05)

> This document tracks all known issues and planned fixes in `smart_extract.js` (V14).
> When starting a new extraction session, review this file to avoid re-introducing known bugs.

---

## 1. Puppeteer Timeout on Heavy Athletics Pages

### Problem

`ukathletics.com/camps` returns "Navigation timeout of 25000 ms exceeded" even though the page loads fine in a browser with real camp data.

### Root cause

`smart_extract.js` line 484: `waitUntil: "networkidle0"` waits for ALL network connections to go idle. Athletics sites load ads, analytics, carousels, and lazy-load content endlessly — `networkidle0` never fires.

### FIX

Change lines 483-485 from:

```js
await page.goto(targetUrl, {
  waitUntil: "networkidle0",
  timeout: 25000,
});
```

to:

```js
await page.goto(targetUrl, {
  waitUntil: "domcontentloaded",
  timeout: 45000,
});
// Give SPA time to render camp data
await new Promise((r) => setTimeout(r, 3000));
```

Also change lines 537 and 558 to use `"domcontentloaded"` instead of `"networkidle0"` for sub-crawls.

---

## 2. StealthPlugin NOT Used (Anti-Detect)

### Problem

`smart_extract.js` uses raw `puppeteer` with manual `webdriver: false` injection (line 370-383). This is weaker than the proper StealthPlugin stack. The V6 engine (`src/utils/extract_camp_details.js`) DOES use StealthPlugin correctly.

### FIX

At the top of the file (line 5), replace:

```js
const puppeteer = require("puppeteer");
```

with:

```js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
```

Then remove lines 370-384 (the manual `targetchanged` webdriver spoof) — StealthPlugin handles this automatically.

---

## 3. Cross-School Email Contamination in contact field

### Problem

The extraction engine finds emails on a page and appends them to the `contact` field WITHOUT any cross-school validation. Example:

- **Florida State** → `contact: "Link Jarrett | gatorsbaseballcamps@ufl.edu"` (Florida's email on FSU's page)
- **North Florida** → `contact: "Joe Mercadante | gatorsbaseballcamps@ufl.edu"` (same)

The `extractData` function (line 204-241) HAS a cross-school email check BUT it only runs on the `email` return value, NOT on the contact field concatenation. The contamination happens when `campPOC` extraction picks up POC + email from the page text and the POC regex captures the whole string including wrong-school emails.

### Data cleanup needed

Clean these contaminated record contact fields (already done, but may reappear in future runs):

- **Florida State** contact → "Link Jarrett"
- **North Florida** contact → "Joe Mercadante"

### Root Cause in the Engine

The `campPOC` regex at line 191 captures contact data like `Contact: FirstName LastName` but it's not cross-validated. When a page has "Coach Smith | coach@wrongschool.edu" in the visible text, the regex grabs it.

### FIX

After the `campPOC` extraction (line 202), add cross-school validation:

```js
if (campPOC) {
  // Cross-check: does this POC's email (if included) match the school?
  const pocHasEmail = campPOC.includes("@");
  if (pocHasEmail) {
    const pocEmailParts = campPOC.match(/([^\s|]+)@([^|]+)/);
    if (pocEmailParts) {
      const pocDomain = pocEmailParts[2].replace(/\./g, "").toLowerCase();
      const schoolNorm = schoolName.toLowerCase().replace(/[^a-z]/g, "");
      // Check all other schools
      for (const [uni] of Object.entries(MASCOT_LOOKUP)) {
        if (uni.toLowerCase() === schoolName.toLowerCase()) continue;
        const otherNorm = uni.toLowerCase().replace(/[^a-z]/g, "");
        if (pocDomain.includes(otherNorm) && otherNorm.length > 3) {
          log(`    ⚠️ POC email belongs to "${uni}" - stripping`);
          campPOC = campPOC.split("@")[0].trim(); // Keep name only
          break;
        }
      }
    }
  }
}
```

---

## 4. URL Discovery & Shadow Tracking (NEW FEATURE)

### What

When the V14 engine discovers sub-URLs during deep crawl (`/register`, `/details`, `/showcase`), persist them in `record.discoveredUrls[]` on the JSON record.

### Why

The main URL is the camp homepage, but dates/costs/POCs are on sub-pages. By shadow-logging them, we avoid re-doing web searches every time we need more data.

### Implementation

Add at the start of the school processing block (after line 440):

```js
const discoveredThisRun = new Set();
if (record.campUrl) discoveredThisRun.add(record.campUrl);
if (record.url) discoveredThisRun.add(record.url);
(record.discoveredUrls || []).forEach((u) => discoveredThisRun.add(u));
```

Then inside the sub-crawl loop (line 547-550), add each found sub-link:

```js
discoveredThisRun.add(sl.href);
```

And before marking processed (line 616), persist them:

```js
record.discoveredUrls = [...discoveredThisRun];
```

---

## 5. Log File Management

### Problem

The `smart_extract_live.log` grows unbounded. When restarting extraction, old logs mix with new ones.

### FIX

Before each extraction run, rotate the log:

```bash
cp smart_extract_live.log smart_extract_live_$(date +%Y%m%d_%H%M%S).log
> smart_extract_live.log  # truncate
node smart_extract.js 2>&1 | tee -a smart_extract_live.log
```

Or use the `--log=path/to/new.log` argument:

```bash
node smart_extract.js --log=smart_extract_$(date +%Y%m%d).log 2>&1
```

---

## 6. Current Data Cleanup (2026-04-05)

Records with cross-contamination (FIXED):

- **Florida State** → contact set to "Link Jarrett" (removed `gatorsbaseballcamps@ufl.edu`)
- **North Florida** → contact set to "Joe Mercadante" (removed `gatorsbaseballcamps@ufl.edu`)

Always re-check these fields after any extraction run — the engine can re-introduce contamination.

---

## 7. 301 Redirects from playnsports (NOT A BUG)

playnsports.com returns 301 permanent redirects for all URLs. Puppeteer follows them automatically and extracts data fine. The raw HTTP checker (Phase 1, `verify_source_urls.js`) flagged these as non-200 but they are all valid. 73 of 164 URLs had 3xx redirects, all leading to working pages.

No code change needed — `puppeteer.goto()` handles this natively.
