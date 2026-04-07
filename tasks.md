# Project Tasks: NCAA Division I Baseball Camps 2026 Compilation

## 💥 Critical Data Integrity & Pipeline Fixes (2026-04-07)

- [x] **Texas Full Recovery**: Reconstructed all 13 camp sessions from the official Texas Longhorns page with full name, dates, cost, time, and ages. Added to `camps_data.json` as properly structured `campTiers`.
- [x] **Email Display Fix**: Fixed `generate_html.js` — card-level `contactEmail` and modal `emailHtml` now fallback through `item.campPOCEmail || item.email || ''`. The V10 extractor never populates `campPOCEmail`, only `item.email`, so 500+ schools were showing "Check site for contact info".
- [x] **Name-near-Email Extraction**: Added `extractNameNearEmail()` in `extraction_engine.js` — parses contextual patterns like "Email Drew Bishop at email@" or "contact: John Smith |" to capture POC names from page text, fixing the "N/A" coach problem for schools where the extraction engine only found emails.
- [x] **Price Test Bare Number Detection**: `test_price_integrity.js` updated to detect cost fields with bare numbers (no `$` prefix) and auto-fix by prepending `$` in `--fix` mode.
- [x] **POC Email Missing from UI**: Fixed `generate_html.js` to display `item.email` when `campPOCEmail` is missing — this was the root cause of "Check site for contact info" showing on 500+ schools.
- [x] **Documentation Updated**: CLAUDE.md, GEMINI.md, and `issues.md` all updated with the "Lost Tiers" pattern, email fallback bug, and name-near-Email extraction fixes.
- [ ] **36 Lost Tiers Recovery**: 36 schools have populated `dates` and `cost` but empty `campTiers: []`. Need targeted re-extraction (`smart_extract.js --school="A,B,C" --force`) or a batch audit/recovery script to repopulate granular session data.
- [ ] **Contact Field Audit**: The extraction engine saves emails to `item.email` but the UI was checking `item.campPOCEmail`. Need to ensure the V10 extractor populates BOTH fields or fix the migration script.

- [x] **V10 Unified Engine**: Created `src/utils/extraction_engine.js` synthesizing 22 best-of-breed features from V7-V9. Unified all search rotation, contamination check, and "no events" autoritative handling.
- [x] **Config Centralization**: Refactored `src/utils/config.js` to hold all 16 global constants (timeouts, regex, phrases). Eliminated hardcoding drift in `extract_camp_details.js` and `extract_verify.js`.
- [x] **Thin Shell Runner**: Refactored `smart_extract.js` into a thin wrapper that delegates exclusively to the V10 engine.
- [x] **Drift Audit Hardening**: Updated `src/tests/test_config_consistency.js` to enforce all 16 V10 tokens across the entire codebase. Guaranteed 100% compliance.
- [x] **Legacy Archiving**: Moved all V7, V8, and V9 extraction scripts and watchdogs to `src/archives/deprecated_engines/`.
- [x] **Data Scrubbing (Final 13)**: Surgically resolved the last 13 price integrity violations. Purged 9 bad-data schools (e.g. Southeastern OK St football, NJIT tickets, Texas Southern 2025). Corrected Gonzaga and SWOSU with real verified 2026 data from browser crawls.
- [x] **Price Test Skip Guard**: Updated `test_price_integrity.js` to skip `isVerified: true` records to prevent false alarms on human-confirmed youth/prospect camps (e.g. Gonzaga $50 pups camp).

## 🧪 Test Suite Hardening & Data Integrity Phase (2026-04-05)

- [x] **Filter Sort Regression Fix**: "Latest Camp Dates" / "Latest Updates" were sorting alphabetically after a previous "fix" added guard conditions (`&& term === '' && costFilter === 'all' && confFilter === 'all'`). Removed guards — date tabs ALWAYS sort desc by date. "All" ALWAYS sorts alpha. Documented in CLAUDE.md, GEMINI.md, issues.md, tasks.md, and in-code "DO NOT BREAK" comments.
- [x] **Bogus $1 Price Fix**: Extraction regex `/\$\d+/` captured partial prices like `$1` from `$100` or `$294` pages. Upgraded to `/\$[\d,]+(?:\.\d{2})?/` with $5 minimum threshold. Created `src/tests/test_price_integrity.js` — scans master JSON for prices under $5, has `--fix` flag. 30 bad entries purged from `camps_data.json`. Slippery Rock corrected from `$1` to `$294/$215` via verified URL.
- [x] **Cross-Contamination Test Suite**: `test_contamination_check.js` existed for extraction unit tests but no data-level scan. Created `src/tests/test_data_contamination.js` — builds .edu domain ownership index from the data itself, then flags any school whose email domain belongs to a DIFFERENT school (e.g. gators@ufl.edu on FSU). Caught and fixed 2 real contaminations (Baylor, UMass Dartmouth).
- [x] **Mandatory Test Pipeline**: `npm test` now runs config consistency + price integrity + data contamination + UI filter tests. `full-update` and `update` scripts include price + contamination tests automatically. Never skip — these tests catch bad data before deploy.

## 🚀 Active Optimization & Stability Phase (2026-04-04)

- [x] Implement isolated dynamic rendering testing in `/Baseball_Camps_2026_dev/`.
- [x] Stabilize `camps_data.json` runtime fetch for dynamic architecture.
- [x] Re-verify UI filter performance on the dev skeleton.
- [x] **Infrastructure**: Finalize `deploy_dev.js` for safe staging environment.
- [x] **New Favicon**: Created premium "26 Baseball" favicon and linked in index.html (eliminating default look).
- [ ] **Icon Stabilization**: Suppress remaining console 404s for external favicons.
- [ ] **Mobile Premium Experience**: Optimize filter button touch targets for one-handed use.
- [x] **Contact Info Consolidation**: Eliminated `contact` + `email` fields. 3 authoritative fields: `campPOC` (name), `campPOCEmail` (email), `headCoach` (separate). All 521 records migrated. 10 scripts updated. Wikipedia head coach lookup: 178 found, 419 total (80%).
- [ ] **Data Audit - DI Programs**: SEC, Big 12 - Verify 2026 dates vs 2025 carryover.
- [ ] **Data Audit - DII Programs**: GAC, CCAA - Confirm missing 404 domains.
- [ ] **Word Export**: Decide if Word document is still needed; regenerate or remove.
- [ ] **URL Maintenance**: Implement a 30-day "Refresher" bot to re-verify existing 200 OK URLs.
- [x] **Filter Sort Bug**: Fix alphabetical re-sort when clicking "All" after "Latest Updates" filter.
- [x] **Date Sort Regression (2026-04-06)**: "Latest Camp Dates" and "Latest Updates" tabs showed alphabetical instead of newest-first. Root cause: extra guard conditions (`&& term === '' && costFilter === 'all' && confFilter === 'all'`) were added to the date-sort branch during the alphabetical fix, causing it to fall through to the alphabetical `else` branch. Fixed by removing guards — date-sort now triggers on `currentDiv` alone. Added "DO NOT BREAK" comments in both `generate_html.js` and `generate_html_dev.js`. Documented in CLAUDE.md, GEMINI.md, and issues.md.
- [x] **Bogus $1 Price Fix (2026-04-05)**: Extraction regex `/\$\d+/` was capturing `$1` from pages showing `$100` or `$294`. Upgraded to `/\$[\d,]+(?:\.\d{2})?/` with $5 minimum threshold. Created `test_price_integrity.js` to scan master JSON. 30 bad entries purged.
- [x] **Cross-Contamination Test (2026-04-05)**: Created `test_data_contamination.js` to scan `camps_data.json` for emails from WRONG schools (e.g. gatorsbaseballcamps@ufl.edu on Florida State). Caught and fixed 2 real contaminations (Baylor, UMass Dartmouth).
- [x] **Mandatory Test Suite**: `npm test` now runs config consistency, price integrity, data contamination, and UI filter tests. `full-update` and `update` scripts include these tests automatically.
- [x] **Texas Cost Missing `$` (2026-04-06)**: Texas entry had bare numbers `485 | 190 | ...` instead of `$485 | $190 | ...`. Fixed all 17 values. Added prevention rule to CLAUDE.md, GEMINI.md, issues.md. Added pre-code-change protocol requiring reading CLAUDE.md, GEMINI.md, issues.md, tasks.md before ANY code changes.

## Current Status

- [x] Create skeletal list of 308 NCAA Division I baseball programs.
- [x] Gather initial camp data for 264 programs (many listed as TBA).
- [x] Create JSON database (`camps_data.json`).
- [x] Generate premium HTML directory (`index.html`).
- [x] Incorporate Division II programs into the dataset (~250+ more).

## [2026-04-03] - UI Price Filter & Data Fidelity Fix

- **FIX**: Resolved "100% broke" price filter. Problem was `null` cost attributes crashing the loop and integer collisions for decimals (like $262.50).
- **ENHANCEMENT**: Implemented `src/tests/test_ui_filter.js` regression suite.
- **DATA CLEANUP**: Wiped stale/source-less costs for Villanova, Seattle, and Seton Hall.
- **DEPLOYED**: Site rebuilt and pushed.

## [2026-04-03] - CRITICAL: Live Filter Fix (ISS-009)

- **FIX (CRITICAL)**: Resolved "Broke live site" price filter regression.
- **ROOT CAUSE**: Regex backslashes (`\d`) were consumed by template literals in `generate_html.js`, resulting in `match(/d+.../` in the browser which failed to find numbers.
- **RESOLUTION**: Double-escaped backslashes (`/\\d+/`) in `generate_html.js` to ensure survival after write.
- **DATA CLEANUP**: Surgically purged 3 corrupted records (LSU, Illinois, West Texas A&M) using `fix_bad_costs.js`.
- **DEPLOYED**: Site successfully rebuilt and pushed to `bmwseals.com/Baseball_Camps_2026/`.

## [2026-04-03] - Logo UI & 50px Upgrade

- [x] Update UI to separate D1 and D2 programs (toggle or filter).
- [x] Complete the dataset for all 300+ D1 programs (total now 559 with D2).
- [ ] Ensure 100% of programs have a valid camp URL, even if dates are TBA.
- [ ] Verify all missing and existing camp URLs for accuracy.
- [x] Finalize Microsoft Word document generation for BOTH D1 and D2.
- [x] Deploy the final directory to the web server (bmwseals.com/Baseball_Camps_2026).
- [x] Verify functionality (search, expand/collapse).

---

## Verification System Tasks

### ✅ Auto-Verified (Script-Detected)

- [x] Define `autoVerified` schema field: campUrl + real 2026 dates + cost ($XX) found by scraper.
- [x] Define `autoVerifiedPartial` schema field: URL found + (dates OR cost) but not both.
- [x] Build `auto_verify.js` — stamps `autoVerified`/`autoVerifiedPartial` flags on all records in `camps_data.json`.
- [x] Integrate `auto-verify` step into `npm run update` pipeline so flags are refreshed on every build.
- [x] Update `generate_html.js` to render **Auto Verified** badge (🤖 green checkmark) on cards where `autoVerified = true`.
- [x] Update `generate_html.js` to render **Partially Verified** badge (🔶 amber) on cards where `autoVerifiedPartial = true`.
- [x] Update `generate_html.js` to render **Not Verified** badge (❓ gray) on remaining cards.
- [x] Add filter buttons to UI: `All | ✅ Auto Verified | 🔶 Partial | ❓ Unverified | 👤 Human Verified`.

### 👤 Human Verified (Community Crowd-sourced)

- [x] Build `verify_human.php` — server-side PHP endpoint that inc/dec verification count per school.
  - [x] Stores counts in `human_verifications.json` on live server.
  - [x] Per-IP rate limiting: 1 vote per IP per school per 24h (privacy-safe IP hashing).
  - [x] Max cap of 100 per school to prevent spam.
  - [x] Supports GET (read counts) and POST (verify/unverify actions).
- [x] Deploy `verify_human.php` to live server at `https://bmwseals.com/Baseball_Camps_2026/verify_human.php`.
- [x] Deploy empty `human_verifications.json` to live server (writable by PHP).
- [x] Deploy empty `human_verifications_ip.json` to live server (writable by PHP).
- [x] Build `fetch_verifications.js` — syncs `human_verifications.json` from live server to local.
- [x] Add **"👤 Human Verified"** button to each school card in UI.
  - Shows current count: `👤 3 People Verified This`.
  - On click: POSTs to `verify_human.php`, updates count inline.
  - If rate limited: shows friendly "You already verified — try again in ~Xh" toast message.
  - Stores voted-school list in `localStorage` to grey-out button after voting.
- [x] Add `sync-verifications` as first step in `npm run full-update` pipeline.

- [ ] During HTML generation, inject `humanVerificationCount` from `human_verifications.json` as a data attribute on each card so initial counts render without a network call.

---

## Smart Targeted Extraction (Missing Data)

### Quality Audit Engine

- [x] Build `quality_audit.js` — scans all 559 records and assigns quality tiers:
  - `COMPLETE (100)`: campUrl + dates + cost + contact + email
  - `GOOD (75)`: campUrl + dates + cost (missing contact/email)
  - `PARTIAL (50)`: campUrl + dates (missing cost)
  - `LOW (25)`: campUrl only (no dates)
  - `EMPTY (0)`: no campUrl at all
- [x] Outputs `missing_data_queue.json` — sorted prioritized work list (lowest score first).
- [x] Protects records with `isVerified=true AND scriptVersion>=5` from re-processing.
- [x] Stamps `autoVerified`/`autoVerifiedPartial` on all records as part of audit run.

### Smart Extract Engine

- [x] Build `smart_extract.js` — reads `missing_data_queue.json` and processes ONLY incomplete schools.
  - CLI args: `--tier=EMPTY`, `--tier=LOW`, `--tier=PARTIAL`, `--limit=N`, `--school="Name"`.
  - Crawls existing `campUrl` for missing dates/cost/email before doing a new search.
  - Only searches for a new campUrl if tier is `EMPTY`.
  - Safely merges found data (never overwrites existing verified fields).
  - Marks `isChecked=true` and updates `scriptVersion` regardless of outcome.
  - Saves progress every 10 schools to prevent data loss on crash.
  - Recomputes `autoVerified`/`autoVerifiedPartial` after each merge.
- [ ] Run `npm run audit` to generate initial `missing_data_queue.json`.
- [ ] Run `node smart_extract.js --tier=EMPTY --limit=50` to fill schools with no URL.
- [ ] Run `node smart_extract.js --tier=LOW` to fill schools missing dates.
- [ ] Run `node smart_extract.js --tier=PARTIAL` to fill schools missing cost.
- [ ] Run `npm run audit` again post-extraction and review tier distribution improvement.

---

## Advanced Features & Filtering

### 📂 Conference & Membership

- [x] Add `conference` field to all 559 records in `camps_data.json`.
- [x] Create `conference_lookup.js` or integrate into `mascot_lookup.js` for mapping.
- [x] Add **Conference Filter** to the UI (dropdown or tags).
- [x] Update UI: Single-line, wrap-enabled conference buttons (no dropdown).
- [x] Renamed 'Independent / Other' to 'Other' for cleaner UI.

### 💰 Cost Range Filtering

- [x] Implement cost range detection logic in the UI based on numeric parsing of existing strings.
- [x] Add **Cost Filter** to the UI (Presets: `All | Under $100 | Under $250 | $250+`).
- [ ] Map cost tiers (Youth vs Prospect) into the `.drawer` expandable modal (Partially implemented via .details).

### 📅 Improved Date Extraction & Search

- [x] Expand **Search Engine Logic** in `smart_extract.js`:
  - [x] Query 1: `[School] baseball summer camp 2026 schedule`
  - [x] Query 2: `"[School]" baseball camp "2026 dates"`
- [x] Implement **Domain Blacklist** (`activekids`, `showcase bureau`) to prevent false information.
- [x] Implement **Official Priority** scoring (`ryzer`, `.edu`, `abcsportscamps`) to find correct URLs.

---

## Immediate Queue / Action Plan (Prioritized)

### P0 (Critical / Data Integrity)

- [x] Verify "Alabama vs Alabama State" and other substring-related contact data isolation (prevent cross-contamination). Now handled by V10 engine logic.
- [x] Implement robust link verification (batch HTTP GET) to ensure all existing `campUrl` records are alive (200 OK). Integrated into extraction pipeline.

### P1 (Active Epic / Core Features)

- [x] Deploy `verify_human.php` and its empty JSON db files (`human_verifications.json`, `human_verifications_ip.json`) to the live server.
- [x] Add the "👤 Human Verified" button interface and POST network logic to `index.html` card UI.
- [x] Download and integrate team logos for all 559 programs (improving premium UI aesthetics).
- [x] Update `index.html` to inject the small team logos visually into the top-right of each card.

### P2 (Enhancements & Polish)

- [x] Implement strict "low cost" flagging to automatically disqualify prices under $100 (e.g., catching high school discounts instead of real college camps).
- [x] Refine Cost aggregator logic in scraper/parser to span arrays of prices rather than defaulting purely to first-found strings.
- [x] Sync verifications from the server to local (update `sync-verifications` script logic).
- [x] Centralize domain filtering into a dedicated `blacklist.json` file for easier maintenance across multiple extraction scripts.
- [x] Regenerate the Word document `NCAA-Baseball-Camps-2026.docx` containing both D1 and D2 complete data.
- [x] Re-deploy the finalized files (logos + PHP files + updated HTML) to the live FTP server.

### P3 (Housekeeping & Arch Improvements)

- [x] [AUTO-DISCOVERED] Add isolated unit tests inside `src/tests/` to guarantee that contact mapping regex does not falsely append data between identically-prefixed schools.
- [ ] Monitor 'Report Error' feedback at rayjonesy@gmail.com post-launch.

---

## [2026-04-06] - Sessions 2 & 3: URL Validator + Contact Consolidation

### ✅ URL Validator Fix (Session 2)

- [x] `isCampRelatedUrl()` too strict — rejected `/sports/baseball` on official athletics domains
- [x] Added known camp platform exemptions (playnsports.com, totalcamps.com, summercampsnavigator.com)
- [x] Restored 42 school URLs (36 playnsports + 6 .edu athletics)
- [x] Camp URL coverage: 331/521 (64%) — 190 still missing (all DII, expected)
- [x] Tests: 52/52 PASS, HTML regenerated

### ✅ Contact Info Consolidation (Session 3)

- [x] Removed `contact` + `email` fields from all 521 records
- [x] Schema: `campPOC` (352 populated), `campPOCEmail` (218), `headCoach` (419)
- [x] Updated 10 scripts to use new field names
- [x] Wikipedia head coach lookup: 276 processed, 178 found, 98 not found
- [x] Bulk cleanup: duplicate emails split, 2025 dates removed, 114 non-baseball tiers purged, $1 prices fixed
- [x] All tests pass (smoke: 22/22, UI filter: 31/31)
- [x] HTML regenerated (prod + dev)

### Remaining Items (from !Task099.txt consolidated)

- [ ] **Mobile Touch Target Optimization**: 44px+ touch targets for filter buttons
- [ ] **D1/DII Data Audit**: SEC, Big 12 — verify 2026 dates vs 2025; GAC, CCAA — confirm 404 domains
- [ ] **Word Export Decision**: Regenerate or deprecate `NCAA-Baseball-Camps-2026.docx`
- [ ] **98 Missing Head Coaches**: Wikipedia didn't find them — try NCAA.org or school rosters.
- [x] **3 Conflicting Dates/Details**: Richmond, Ouachita Baptist, Thomas Jefferson — flagged for review. Fixed via manual verification.
- [ ] **382 Empty sourceUrl**: Low priority — consider fallback from `campUrl`.

---

## 📜 Lessons Learned / Context Preservation

### Data Integrity Failures (April 2026)

- **Problem**: Manually verified schools (SEC) were reverted by automated script runs.
- **Root Cause**: Missing check for `isVerified` status in early iterations of `smart_extract.js` and inconsistent `scriptVersion` logic.
- **Fix**: Implemented `restore_data_integrity.js` to patch SEC programs back to "Verified" and "SEC".
- **Prevention**: Scripts MUST now check `if (school.isVerified) continue;` or equivalent before mutation.

### UI Filtering & Performance

- **Problem**: Dropdown filters for conferences were non-intuitive.
- **Resolution**: Switched to a standard flex-wrap row of buttons. Performance remains high with 560 cards because of the optimized text-based filtering in the browser.

### Conference Mapping

- **Note**: Notre Dame is ACC for baseball (2026). Stanford/Cal/SMU are also ACC. Always check the `CONFERENCE_LOOKUP` in `src/utils/` before doing batch updates.

---

## [2026-04-04] - Granular Timestamp Tracking & Dual-Filters (V8/V9)

- [x] Implement section-specific timestamps: datesUpdateDate, contactUpdateDate, costUpdateDate, detailsUpdateDate.
- [x] Build src/utils/scrub_data.js V2 to intelligently manage and sync these granular timestamps based on data region refinement.
- [x] Update generate_html.js to map these timestamps to card attributes (data-dates-update and data-last-update).
- [x] Add dual-tracking navigation buttons: Latest Camp Dates and Latest Updates.
- [x] Implement dynamic DESC sorting: float the freshest data (based on the active filter's timestamp) to the top of the list.
- [x] Create and run src/tests/test_granular_tracking.js unit and integration suite (100% pass).
- [x] Re-deploy stabilized directory to bmwseals.com.
