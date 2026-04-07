# Project Context & Rules - NCAA Division I Baseball Camps 2026

## Global Project Rules

- **Aesthetics First**: The web application `index.html` must look premium. Use modern typography (Inter, Outfit), vibrant colors, and smooth animations.
- **Accuracy**: All data must be verified from official athletics sources. If no data exists, clearly state "TBA / No information posted".
- **URL Completeness**: 100% of programs must have a valid camp registration URL or athletic department baseball URL, even if specific camp dates are noted as TBA.
- **URL Verification**: Links must be verified to exist and load without errors.
- **Fidelity to Target**: Support over 300 NCAA Division I baseball programs and all Division II programs.
- **Microsoft Word Export**: The data must be exportable to a Word document using the standard table format provided in the raw files.
- **No Placeholders**: Do not use placeholder content. Use real camp information or a clear "TBA" status.
- **Coach / POC Data**: Each school MUST have both a Head Coach / POC name AND an email address whenever possible. If found separately, they must be merged/concatenated, never overwritten.
- **Source URL Fidelity**: The "Visit Site" link in the final UI MUST match the exact URL where camp data was extracted. This metadata should be captured during extraction and saved in the JSON database.
- **Blacklist Management**: Maintain a central `blacklist.json` file containing all junk, third-party, and irrelevant domains. All extraction scripts MUST load this file dynamically to ensure filtering consistency.
- **Feedback Loop**: The UI must include a "Report Error" contact form that sends feedback to 'rayjonesy@gmail.com'.
- **Verified Data Preservation**: High-fidelity, manually verified data (such as the Arkansas registration forms) MUST be saved as separate JSON files in the `verified/` directory. The automated extraction script MUST explicitly skip any school that possesses verified flags (`isVerified: true`, `isChecked: true`, `scriptVersion >= 5`), to ensure verified data is never accidentally overridden.
- **Extraction Protocol (IMMUTABLE)**: The extraction engine MUST follow the **V6 Ultra-Fidelity** standard as defined in [EXTRACTION_ENGINE.md](file:///x:/NCAA-DivisonI-Baseball-Camps-2026/EXTRACTION_ENGINE.md).
  - **Security First (MANDATORY)**: NEVER commit credentials, API keys, or private configuration folders to the git repository.
  - The `.credentials/` directory and `.claude/` directory MUST remain in `.gitignore`.
  - ALL shared configuration (blacklists, regex, platform lists) must be centralized in `src/utils/config.js` to avoid drift.
  - AUTOMATED GUARD: Always verify that `node src/tests/test_config_consistency.js` passes before any deployment or push.

## Current Knowledge

- The initial goal was for DI baseball camp data, but it has been expanded to include all 300+ NCAA DII programs.
- Total programs in database: 559.
- Most D1/D2 programs have not yet posted their summer/fall 2026 camp dates as of April 2026.
- Raw data is being compiled from official athletics websites (`[school]athletics.com` or `ryzer.com`).
- The directory will be hosted at `https://bmwseals.com/Baseball_Camps_2026/`.
- **UI Architecture**: Features a robust client-side filtering system allowing multifaceted drill-down (Division -> Conference -> Auto/Human Verified -> Estimated Tier Cost -> String Match).

## Lessons Learned

- **Deduplication**: When merging data, unique hashing for university names is essential to prevent double-counting.
- **Parsing**: Standardizing Markdown table parsing is key to importing batch-collected data.
- **Word Formatting**: Consistent Calibri/Arial Size 11 text is expected for the Word document.
- **UI Scalability**: As the dataset grew (550+ entries), a tabbed/filtered interface became necessary for premium usability.
- **FTP Path Logic**: Live server paths often diverge from documentation; listing directories with `curl` is the most reliable verification method.
- **Strict String Matching**: ALWAYS use strict equality (`===`) or exact regex boundaries when mapping data properties like Coach Names based on University string matching. A lazy `.includes('Alabama')` will globally overwrite specific auxiliary branches ('Alabama A&M', 'South Alabama', etc.) resulting in cross-contamination bugs.
- **Division Overrides**: The user's specific constraints regarding NCAA division taxonomy (e.g. enforcing SWAC schools like Alabama A&M / Alabama State as DII) overwrite technical real-world structural facts. Honor the user's mapping rule directly over Wikipedia classifications.
- **Broad Regex Scope**: Don't rely exclusively on text-based dates (`(?:Jun|Jul|Aug)`). Schedule tables predominantly use raw numerical structures (`[5-8]/\d{1,2}/\d{2,4}`). Both must be targeted.
- **Nested Crawler Traversal**: High-tier or granular data (like "Elite Camp" prices vs "Youth" tiers) are almost never on the domain's root html path; they're nested under `/register` or `/details`. Scraping `document.body.innerText` strictly onto the first matched URL skips primary features. A micro-crawler identifying nested href loops vastly improves depth.
- **Dataset Versioning**: Introduce object tracking tags like `scriptVersion: 2` at the object JSON level to ensure future processing loops can gracefully filter which objects have passed the latest criteria.
- **Data UI Rendering**: When aggregating massive permutations of data (like multi-week camps), standard card DOM rendering breaks typography bounding boxes. To fix: strictly truncate `>2` array indices visually on the front-face, and push the full list cleanly mapped into an `<ul>` element within the `.drawer` expandable modal.
- **Preserve Human Contact Logic**: Whenever scripts successfully extract an `email` via regex, NEVER carelessly overwrite the pre-existing `contact` field! Safely concatenate strings (`Coach Name | email@edu`) so the human data is preserved.
- **Mascot-Based Search Queries**: NEVER use logoDomain fragments (e.g. "uasys", "ua") in search queries — they produce garbage results. Always use proper mascot/nickname via `mascot_lookup.js` (e.g. "Arkansas Razorbacks baseball camp 2026"). 559/559 mascots are mapped.
- **University Alias System**: To prevent false-rejections, implemented a dynamic alias generator (UTM, Tenn Martin, etc.) that validates candidate pages even if they don't use the full official university name.
- **Watchdog Stability**: Implemented a 45s inactivity monitor (`watchdog.js`) that auto-restarts the scraper if Puppeteer hangs. Combined with a 90s per-school timeout and internal log "pulses" during long sub-crawls, this ensures continuous 100% processing of the 559-school database.
- **Resumption Logic**: To prevent redundant processing after a watchdog restart, the scraper MUST mark a school as `isChecked: true` and update `scriptVersion` regardless of the outcome (Success, No Data, Error, or Timeout). This ensures the `toProcess` list strictly shrinks over time.
- **Substring Contamination Safety**: When checking if a page belongs to the wrong school, ALWAYS use **case-insensitive** bidirectional substring checks. "Arkansas" contains "Kansas" (case-insensitive), so Kansas must be skipped in contamination checks.
- **Sub-crawl Deduplication**: Optimized recursive crawling to skip any URLs already in search-result queue, preventing loops (-20% processing time).
- **All-Month Detection**: Restricted date parsing to `Jun|Jul|Aug` was a critical failure. V6 scans all 12 months to capture year-round sessions.
- **Module Scope Stabilization**: Explicit function exposure is mandatory in complex modular environments to prevent ReferenceErrors during remote imports.
- **Source-to-JSON Pipeline**: Every piece of data must be associated with the `sourceUrl` it was found on to ensure button fidelity.
- **UI Filtering Integrity**: When implementing client-side filters (price, date), always use defensive null-guards (`|| ''`) and robust regex parsing for decimals. Failing to guard against `null` attributes from `getAttribute()` will crash the entire `filter()` loop, rendering the directory blank. Always verify filter logic with `src/tests/test_ui_filter.js`.
- **Sorting Rules (generate_html.js / generate_html_dev.js)**: The sort block MUST be: `(currentDiv === 'newdates' || currentDiv === 'updates')` → date-desc sort (ISO timestamps, newest first); `else` → alphabetical by university. **NEVER** add guard conditions like `&& term === '' && costFilter === 'all' && confFilter === 'all'` to the date-sort branch — this breaks date tabs by falling through to alphabetical. The "All" tab sorts alphabetically because `currentDiv === ''` naturally falls to the `else` branch. Always test: click "All" → verify alphabetical; click "Latest Camp Dates" → verify newest-first; click "Latest Updates" → verify newest-first. Both generators carry a "DO NOT BREAK" comment. Regenerate HTML after any sort changes.
- **Third-Party Showcases (Blacklist)**: Sites like `activekids.com` and `collegebaseballcamps.com` frequently match school name keywords but are not official camps. Implement domain blacklisting and link prioritization (`ryzer.com`, `.edu`) to maintain data integrity.
- **Conference/Cost Filtering**: Massive datasets (559 schools) require multi-dimensional filtering to be usable. Harvesting unique conferences and implementing numeric cost parsing at the UI layer is essential for premium UX.
- **DII Scarcity Awareness**: Acknowledge that a subset of NCAA DII programs may not host independent summer camps or may only do so biennially. For these schools, an exhaustive multi-engine search resulting in "No Data" is a valid terminal state.
- **Strict Contamination (Alabama vs Alabama State)**: Re-enforce strict substring boundaries. "Alabama" must not match "Alabama State" unless explicitly intended. Verified data for one must never leak to the other based on sloppy `.includes()` checks.
- **Dual Contact Fields**: Ensure the database schema supports both `contact` (Name) and `email`. If only one is found, keep the existing other one. If both found, present both.
- **Team Camp & Legacy Date Filtering**: High prices (e.g., $1000+) are sometimes legitimate for extensive individual camps. Instead of capping costs, strict exclusion logic now drops the entire page from extraction if the text explicitly states "Team Camp" (without also saying "individual") or heavily references "2025" without containing "2026". This prevents stale legacy pages from feeding false pricing data into the database.
- **Audit Status Persistence**: Implemented `auditStatus` tracking in the master dataset. Records are now intelligently re-queued if they previously resulted in `URL_MISMATCH`, `NO_DATA`, or contained "Thin Results" (TBA dates/costs). This prevents the "infinite loop" of re-checking successful yet incomplete records without a search fallback.
- **Automated Deep Search Fallback**: Flagship programs with elusive portals now trigger a Phase 3 "Deep Search" (top 10 results + specific keywords) if standard validation and consensus search fail. This resolved discovery issues for major SEC and Big 12 programs.
- **DOM Node Validation**: When extracting interactive elements from a `<template>` rendering engine (e.g., pulling a "Verify" button out of a modal template and into the parent card block), ALWAYS verify that all event listeners accessing that node (like an `openDetails` popup modal logic) are explicitly updated with `if(node)` guards. Failure to trace moved DOM elements causes hard Javascript crashes (`TypeError`).
- **Distributed State Synchronization**: When maintaining dual representations of the same state (e.g., a "verified badge" counting on top of the card AND the number inside the verification "action button"), backend-fetches MUST recursively select and update EVERY instance of the data attribute spanning the DOM. Failure to update all mirrors results in UI "flicker" where user clicks immediately desync local state against server cache.
- **Granular Timestamp Tracking**: To support specialized UI search/filtering (e.g., "New Dates" vs "Any Update"), the master schema must maintain section-specific timestamps (`datesUpdateDate`, `contactUpdateDate`, etc.) instead of a single binary `lastUpdateDate`. This maintains high discoverability for specific data refreshes while allowing global DESC sorting for overall freshness.
- **Cost Field Must Always Have `$` Prefix (2026-04-06)**: The `cost` field and `campTiers[].cost` values MUST always start with `$` when they contain numeric prices. Extraction engine initially produced bare numbers (e.g., `485 | 190 | 190` for Texas) which broke UI cost filtering. The extraction regex MUST capture the `$` together with digits: `/\$[\d,]+(?:\.\d{2})?/`. Any extracted price without `$` will fail `test_price_integrity.js`.
- **Hierarchical Price Integrity (2026-04-06)**: Transitioned standard `MIN_VALID_PRICE` to `PRICE_THRESHOLDS` in centralized `config.js` (`CRITICAL_ANOMALY: <$5`, `SUSPICIOUS_LOW: <$50`, `VERIFY_MANUALLY: <$100`). The V6 extraction engine uses this authoritative script to automatically discard anomalies, and backend integrity tests (`test_price_integrity.js`) use it to auto-purge critical artifacts (requiring re-extraction) and flag suspicious prices for manual review using `auditStatus = "PRICE_CHECK_NEEDED"`.
- **HTML Generator Email Fallback (2026-04-07)**: The UI email display in `generate_html.js` was checking ONLY `item.campPOCEmail`, but the extraction engine saves emails to `item.email`. The `campPOCEmail` field is NOT populated by the V10 extraction engine, so 500+ schools showed "Check site for contact info" even when valid emails existed. Fix: email display must use `item.campPOCEmail || item.email || ''` fallback chain. Applied to both card-level `contactEmail` and modal-level `emailHtml`.
- **"Lost Tiers" Data Loss Pattern (2026-04-07)**: 36 schools had populated `dates` and `cost` fields but EMPTY `campTiers: []`. The extraction engine's `extractDataFromText()` DOES populate tiers correctly, but a subsequent merge/normalize step in `finalize_database.js` or similar pipeline overwrites the array. NEVER overwrite `campTiers` with `[]` during normalization — preserve existing array data. Recovery requires running `smart_extract.js --force` on affected schools.
- **Name-near-Email Extraction (2026-04-07)**: Pages like "Email Drew Bishop at Drew.Bishop@athletics.utexas.edu" lose the POC name because `harvestEmails()` only captures the email. The `extractNameNearEmail()` function in `extraction_engine.js` now parses contextual name patterns ("emailing X at", "contact: X |", "X — email@") and populates `pointOfContact` as a fallback when existing `pointOfContact/campPOC` is N/A.
- **Single-Line String Enforcement (2026-04-07)**: JavaScript single-quoted (`'`) and double-quoted (`"`) strings in the HTML generators (`generate_html.js`) MUST NOT contain literal newlines. Doing so causes an `Uncaught SyntaxError` in the generated `index.html`. Always keep generated JS strings on a single line or use string concatenation.
- **Complex UI Logic via IIFE (2026-04-07)**: When generating complex conditional HTML (like the "Visit Site" button with multiple states), wrap the logic in an Immediately Invoked Function Expression (IIFE) within the template string. This allows for cleaner, more robust logic (using `if/else`, variables, etc.) than nested ternaries and ensures attributes are not incorrectly injected as text content.

## Pre-Code-Change Protocol (MANDATORY)

**BEFORE making ANY code changes, ALWAYS read ALL 4 documentation files:**

1. `CLAUDE.md` — context, rules, lessons learned
2. `GEMINI.md` — mirrored context for cross-agent consistency
3. `issues.md` — known issues, bugs, and their resolution status
4. `tasks.md` — task queue, completed items, and pending work
   Also read `!Task099.txt` for the current work queue from the data integrity audit.
   This prevents repeating already-fixed issues and ensures awareness of all open/ resolved problems.

## Infrastructure

- **Search**: The HTML directory must have a real-time reactive search by university, coach, or keyword.
- **Expandable Cards**: Detailed information (What to bring, address, etc.) should be tucked into expandable UI elements.

## Future Plans

- Re-check programs in May/June 2026 for updated camp information.
- Finalize the Word document for the user's offline reference.

## Architecture & Data Flow

The pipeline has four stages that feed into each other:

1. **Extraction** → `smart_extract.js` (orchestrator) calls `src/utils/extract_camp_details.js` (V6 Puppeteer engine). It processes schools from `camps_data.json` with resumption logic — only schools missing `isChecked: true` or flagged for re-queue are processed. Results flow through mascot-based search → page validation → sub-crawl → date/price/contact extraction → JSON merge.

2. **Verification** → `auto_verify.js` validates extracted URLs via HTTP HEAD. `verify_human.php` provides a manual verification endpoint (stored in `human_verifications.json`). `src/tests/verify_*.js` scripts run spot-check audits.

3. **Generation** → `generate_html.js` reads `camps_data.json` and produces `index.html` (5.5MB, client-side rendered, no build step). `generate_html_dev.js` produces `index_dev.html` (~55KB shell that fetches JSON at runtime). `src/utils/generate_word_doc.js` produces the Word export.

4. **Deploy** → `deploy.js` uploads `index.html` and assets via FTP to `/Baseball_Camps_2026/`. `deploy_dev.js` uploads dev version to `/Baseball_Camps_2026_dev/`. Credentials live in `.credentials/` (gitignored).

### Dynamic Rendering Test (2026-04-04)

A parallel path exists for testing a lightweight dynamic rendering approach:

- `generate_html_dev.js` → Generates ~55KB HTML shell that fetches `camps_data.json` at runtime and renders cards client-side
- `deploy_dev.js` → Deploys to `/Baseball_Camps_2026_dev/` (isolated test directory on the same server)
- Total payload: ~855KB vs 5.4MB production — 6x reduction
- Modal content stored as `encodeURIComponent()` on each card, decoded on click
- Verify buttons use `data-verify-school` attributes + event delegation (no inline onclick with quote escaping)
- `npm run generate:dev` + `npm run deploy:dev` for test deployments

**Key data shapes:**

- `camps_data.json`: Array of school objects with fields: `university`, `division`, `conference`, `divisionLevel`, `contact`, `email`, `campDates`, `prices`, `url`, `sourceUrl`, `isVerified`, `isChecked`, `scriptVersion`, `auditStatus`, `lastUpdateDate`, and granular timestamps (`datesUpdateDate`, `contactUpdateDate`, `priceUpdateDate`, `urlUpdateDate`).
- `blacklist.json`: Array of third-party/junk domains to exclude during extraction.

## Directory Structure

To maintain a clean root folder, follow this standard structure for scripts and files:

- **Root (`/`)**: Core active production files only (`camps_data.json`, `index.html`, `smart_extract.js`, `generate_html.js`, `deploy.js`, `quality_audit.js`, `watchdog.js`).
- **`src/tests/`**: All debugging, experimental, verification, and module testing scripts (`test_*.js`, `verify_*.js`).
- **`src/debug/`**: Execution outputs, isolated sandbox scripts (`debug_*.js`), and screenshot dumps from Chromium.
- **`src/archives/`**: Deprecated scripts (e.g., `watchdog_v8.js`, `extract_camp_details_v7.js`), old iterations of extraction logic, and one-off injection macros (e.g., `inject_arkansas.js`).
- **`verified/`**: Raw pristine JSON backups of perfectly human-verified subsets.
- **`assets/`** & **`screenshots/`**: Visual assets, fetched team logos, etc.
- **`src/utils/`**: Shared modules including `config.js` (centralized config), `extract_camp_details.js` (V6 engine), `mascot_lookup.js` (559 mascot mappings), conference utilities, and data merge/finalize scripts.

## Common Commands

```bash
# Install dependencies
npm install

# Run config consistency test (must pass before deploy/push)
node src/tests/test_config_consistency.js

# Run UI filter test
node src/tests/test_ui_filter.js

# Regenerate HTML from camps_data.json
npm run generate:html          # node generate_html.js  (production, 5.4MB)
npm run generate:dev           # node generate_html_dev.js (dev, ~55KB shell)

# Generate Word document export
npm run generate:word          # node src/utils/generate_word_doc.js

# Run quality audit
npm run audit                  # node quality_audit.js

# Deploy to servers
npm run deploy                 # node deploy.js  (production → /Baseball_Camps_2026/)
npm run deploy:dev             # node deploy_dev.js (staging → /Baseball_Camps_2026_dev/)

# Full update pipeline (fetch verifications → extract → audit → generate → deploy)
npm run full-update

# Finalize/process extracted data into final JSON format
node src/utils/finalize_database.js
```

## Notes

- `index.html` is generated, not hand-edited. All UI changes must be made in `generate_html.js`.
- `generate_html.js` embeds all CSS/JS inline — there is no separate build step or bundler.
- The frontend uses a `<template>` rendering engine for camp cards. When moving DOM elements between the template and parent, always update ALL event listeners with `if(node)` guards.
- No linter or formatter is configured in the project.
- Node.js 18+ required.
