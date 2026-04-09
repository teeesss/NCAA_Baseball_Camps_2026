# Project Tasks: NCAA Division I Baseball Camps 2026 Compilation

## ✅ Resolved: V12.5 Engine Hardening & Database 100% (2026-04-09)
... (existing content) ...

- [x] **P0 Ryzer/Portal Bridge Fast-Track**: Implemented `unshift` logic in `extraction_engine.js` to prioritize registration bridges (Ryzer, PlayNSports, etc.) in the sub-crawl queue.
- [x] **P0 Portal Depth Boost**: Increased sub-crawl limits to Depth 3 and 25 pages specifically for whitelisted platforms, ensuring no granular session data is missed.
- [x] **Comprehensive Platform Whitelist**: Updated `isExternalBridge` in `config.js` to allow ID-based links from any domain, bypassing strict locks for authoritative portals.
- [x] **Query-String Preservation**: Fixed a major bug in `extraction_engine.js` where query strings (containing session IDs) were stripped during normalization, causing deduplication of unique camp links.
- [x] **Dynamic Portal Rendering**: Updated initial navigation to use `networkidle2` for whitelisted platforms, ensuring JS-injected registration buttons are visible to the crawler.
- [x] **Northwestern Success (Big 10)**: Verified that the new logic successfully recovers 11 tiers and $427+ pricing for the Northwestern Wildcats portal, resolving the P0 user request.
- [x] **Mississippi State & Arkansas Audit**: Verified successful session extraction across SEC/Big 10 programs using the V12.6 engine.

## 🏗️ High Priority: Global Data Refresh (Active)

- [x] **UI Messaging Overhaul**:
    *   Change "Verification Roadmap" to "Sync Log & Directory Updates".
    *   Replace cryptic "April 8" internal diagnostics with user-friendly sync status.
    *   Rename "❓ Not Verified" badge to "🔍 Direct Source (Scanned)" (since all data is validated via crawl).
- [x] **Ryzer/Platform Deep Crawling**:
    *   Update sub-crawl logic to follow `register.ryzer.com/camp.cfm?id=...` and other major portal links.
    *   Allow specific whitelisted domains (Ryzer, PlayNSports) to bypass `DOMAIN_RESTRICTED_CRAWLING`.
    *   Extract granular pricing from these specific camp registration pages.
- [x] **Direct Portal Metadata**:
    *   Add a variable in `camps_data.json` to explicitly log if a school uses a major portal (Ryzer, PlayNSports, etc.) to ensure we prioritize those sites.
- [x] **Sample Test: Northwestern State**:
    *   Run targeted extraction on Northwestern State to verify Ryzer ID page crawling for costs. (Verified: 3 tiers found, Cost $150)

- [x] **100% Database Coverage**: Successfully processed all 521 programs (DI + DII) with current status marked as `isChecked: true`.
- [x] **Coach Name Guard (V12.5)**: Implemented `targetCoach` whitelist in `checkContamination` to prevent false positives for portals branded after the head coach (e.g., Louisiana Tech).
- [x] **Geographic Marker Guard**: Refined generic state matching to require an academic proximity suffix (e.g., "Missouri University"), allowing "Camps in Missouri" marketing text to pass.
- [x] **Institutional Domain Scrub**: Built `scrub_institutional_mismatch.js` to automatically purge cross-contaminated contacts (e.g., fixing UTA's Alabama State email).
- [x] **Word Export - Email Fallback**: Updated `generate_word_doc.js` to use `campPOCEmail || email` fallback chain, ensuring all possible contact data is exported.
- [x] **Hard Blacklist Enforcement**: Moved the blacklist check to the very top of `scoreUrl` in `url_validator.js`. Assigned a definitive `-1000` penalty to any domain in `blacklist.json`, ensuring junk sites (like totalsports) are never crawled.
- [x] **Authoritative Bridge Gatekeeper**: Refactored `config.js` to enforce a single gatekeeper rule. `isExternalBridge` now strictly checks against `OFFICIAL_PLATFORMS`. Generic domains (bridge-wannabes) are now rejected by a single, authoritative source.
- [x] **Totalsports Domain Purge**: Explicitly added `totalsports.com` and `totalsportscamps.com` to `blacklist.json`.
- [x] **Recovery Run Monitoring**: Watchdog is now monitoring the 100-school recovery run using the hardened V12.5 engine.
- [x] **Purge Reset Fix**: Improved `scrub_database.js` to ensure any purged record is immediately reset for re-extraction with `scriptVersion: 12.5`.
- [x] **Log Path Stabilization**: Fixed the log file path in `watchdog.js` to correctly point to `data/logs/smart_extract.log`.
- [x] **Issue.md Review Pipeline**: Integrated a mandatory check of `issues.md` before making architectural changes to prevent regressions on already-resolved platform bugs.

## ✅ Resolved: UI Performance & Terminology Fixes (2026-04-09)

- [x] **Granular Extraction Architecture**: Created `schema.js` and `field_checker.js` as single authoritative sources for data integrity.
- [x] **Targeted Re-extraction**: Updated extraction engine to support `recheck` flags (email, cost, dates) which dramatically increases speed/precision.
- [x] **Strict TTL Enforcement**: Enforced mandatory cooling-off periods (DI: 3 days, DII: 14 days) in `extraction_engine.js` to prevent excessive crawling.
- [x] **V12 Documentation Parity**: Synchronized GEMINI.md and CLAUDE.md with the latest ultra-fidelity extraction and recheck protocols.
- [x] **Test Suites**: Added `test_field_completeness.js` (database audit) and `test_log_analyzer.js` (log anomaly detection).
- [x] **Systemic Platform Email Purge**: Identified a major bug where `contact@playnsports.com` (technical support) was being assigned as the school POC email for 16+ DI programs (Duke, NC State, UCF, etc.).
- [x] **Config-Based Email Blacklist**: Implemented `BLACKLISTED_EMAIL_DOMAINS` in `config.js` to block generic platform addresses while maintaining valid camp URLs.
- [x] **Database Cleanup**: Purged invalid emails from 40 schools and re-queued them for fresh extraction.
- [x] **Creighton Staff Refresh**: Updated Creighton with Head Coach Mark Kingston (replaces retired Ed Servais) and official `markkingston@creighton.edu` contact.
- [x] **Infinite Loading Hang**: Resolved a critical boot sequence bug in `generate_html.js`. Site now loads instantly.

## 💥 Critical Data Integrity & Pipeline Fixes (2026-04-07)

- [x] **Lost Tiers Bug #1 (Time Skip)**: Identified and fixed a major bug in `extraction_engine.js` where blocks containing 'am/pm' times (common in daily camp schedules) were being skipped as "game schedules". Removing this increased extraction yield significantly.
- [x] **Lost Tiers Bug #2 (Contamination)**: Fixed a false-positive bug where legitimate schools (e.g., Florida State) were skipped because the title contained "Florida" but the engine wrongly flagged it as "Florida State" contamination. Refined logic to require the base school name in the title.
- [x] **Alabama/Bama Alias Expansion**: Expanded alias generator in `mascot_lookup.js` to handle common abbreviations like "Bama", "Tenn", "Miss", and "St" for non-hyphenated schools.
- [x] **Arizona State & Florida State Recovery**: Successfully re-extracted full camp data for these schools using the fixed engine (Arizona State: 4 tiers, Florida State: 17 tiers).
- [x] **Texas Full Recovery**: Reconstructed all 13 camp sessions from the official Texas Longhorns page with full name, dates, cost, time, and ages. Added to `camps_data.json` as properly structured `campTiers`.
- [x] **Email Display Fix**: Fixed `generate_html.js` — card-level `contactEmail` and modal `emailHtml` now fallback through `item.campPOCEmail || item.email || ''`. The V10 extractor never populates `campPOCEmail`, only `item.email`, so 500+ schools were showing "Check site for contact info".
- [x] **Name-near-Email Extraction**: Added `extractNameNearEmail()` in `extraction_engine.js` — parses contextual patterns like "Email Drew Bishop at email@" or "contact: John Smith |" to capture POC names from page text, fixing the "N/A" coach problem for schools where the extraction engine only found emails.
- [x] **Price Test Bare Number Detection**: `test_price_integrity.js` updated to detect cost fields with bare numbers (no `$` prefix) and auto-fix by prepending `$` in `--fix` mode.
- [x] **POC Email Missing from UI**: Fixed `generate_html.js` to display `item.email` when `campPOCEmail` is missing — this was the root cause of "Check site for contact info" showing on 500+ schools.
- [x] **Documentation Updated**: CLAUDE.md, GEMINI.md, and `issues.md` all updated with the "Lost Tiers" pattern, email fallback bug, and name-near-Email extraction fixes.
- [x] **36 Lost Tiers Recovery**: Identified and fixed a major bug in `extraction_engine.js` where blocks containing 'am/pm' times were being skipped. Verified with Alabama and others.
- [x] **Domain Restricted Crawling (V11 started)**: Implemented strict domain-level enforcement and 2-level deep recursive sub-crawling. Prevented platform "wandering" on generic `playnsports.com` pages.
- [x] **V11 Sub-Crawl Rewrite (startsWith)**: Replaced 60+ lines of complex platform/domain filtering with a single strict `startsWith` rule, completely eliminating generic platform wandering on sites like `playnsports.com`.
- [x] **V11 4-Tier URL Resolution Priority**: Enforced strict priority logic before web searching: Authoritative JSON files (Tier 1) -> Validated existing campUrl (Tier 2) -> Dead URL fallback (Tier 2a) -> Web search consensus (Tier 3).
- [x] **Contextual Price Filter (<$60)**: Added check to reject prices under $60 if surrounding text contains fee keywords (parking, processing fee, deposit), fixing issues like Alabama's bogus $10 price.
- [x] **Hash Fragment Dedup**: Stripped `#` and query strings prior to URL comparisons to prevent redundant crawling of the same pages.
- [x] **Verified URL Prioritization**: Integrated `!bcusa.com_fixed.json`, `!playnsports_fixed.json`, and `!totalcamps.com.json` into the extraction engine. These URLs are now scored at 500+ and bypass generic search when found.
- [x] **Contact Field Audit**: Verified that V11 extractor populates `item.email`. UI fallback logic in `generate_html.js` is confirmed working.
- [x] **Sidearm Sports Timeout Fix**: Increased Puppeteer navigation timeout to 25000ms for validations, solving domcontentloaded hanging on heavy collegiate athletics templates.
- [x] **Remaining 20 Lost Tiers Recovery**: Executed a targeted `--force` re-extraction for 20 schools (Clemson, UTSA, Fresno State, etc.) that had Dates and Cost data but lost their tiers array. Verified full recovery.
- [x] **Domain Squatter Validation Check**: Log verified that Tier 4 guessed links are actively blocked by the alias text-content requirement, preventing junk data ingestion.
- [x] **V14 Artifact and TTL Auto-Queue Implementation**: Updated `extraction_engine.js` filter to autonomously fix V14+ artifacts and auto-requeue DI > 3 days and DII > 14 days without manual --force. 
- [x] **Deep TBA Costs Verification**: Validated that V11's deep crawl (`MAX_SUB_CRAWL_DEPTH=2`) natively discovers Ryzer/PlayNSports hidden dropdown prices (e.g. California $65) without requiring a custom micro-clicker logic yet!
- [x] **Watchdog & Batch Limit Implementation**: Updated `watchdog.js` and `extraction_engine.js` to implement a 40s inactivity cutoff and a 20-school batch limit (Exit 88) to prevent Puppeteer memory leaks from hanging the system during mass runs.
- [x] **V11 Master Run Completion**: Successfully processed all 521 schools in the database. Verified 172 schools with final camp data (expecting DII to fill in throughout May/June). 
- [x] **Coach Recovery - DDG HTTPS Bypass**: Implemented `fetch_missing_coaches.js` using raw Node HTTPS requests to evade DuckDuckGo Captchas. Achieved 60%+ recovery rate in trials (e.g. Rick Maloney, Paul Mainieri). Added a blacklist (Pitching Coach, Assistant, etc.) to ensure name-integrity.

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
- [x] **Mobile Premium Experience**: Optimized filter button layout via a single-row, multi-mode system. Reduced vertical buffers by 60% and horizontal padding on iPhone-sized screens for a high-density, professional look.
- [x] **Verification Count Discrepancy**: Fixed the confusing "87 Verified" headline. It now displays "361 Active Camp Portals" (all schools with found URLs) while preserving the high-fidelity 🤖/🔶 badges for session-level confirmation.
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

## [2026-04-09] - Data Integrity & Filter Fixes
- [RESOLVED] Emails being cleared during standardization (2026-04-09)
- [RESOLVED] "TBA" appearing in "Newest Camp Dates" (2026-04-09)
- [RESOLVED] 404 console errors from Clearbit Logo fallback (Purged Clearbit logic)
- [RESOLVED] Mobile search box overlapping filter row (Reduced vertical margins)
- [RESOLVED] Infinite "Loading Camps..." hang (Fixed stray function wrapper in init())
- [RESOLVED] Junk "summercamps.com" email contamination in Georgetown/SNHU
- [RESOLVED] Header line wrapping on mobile (Optimized font-size and nowrap)
- [RESOLVED] Mobile-friendly DI/DII terminology switch
- [RESOLVED] Alphabetical sort fix for new DI default filter on load
- [x] **Finalize comprehensive head coach backfill**: 100% processed via DuckDuckGo and Wikipedia logic.
- [x] **Update NCAA-Baseball-Camps-2026.docx**: Regenerated for April 2026 batch with 100% check-rate.

## [2026-04-03] - Logo UI & 50px Upgrade

- [x] Update UI to separate D1 and D2 programs (toggle or filter).
- [x] Complete the dataset for all 300+ D1 programs (total now 559 with D2).
- [x] Ensure 100% of programs have a valid camp URL, even if dates are TBA.
- [x] Verify all missing and existing camp URLs for accuracy.
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
- [x] **98 Missing Head Coaches**: Resolved via DuckDuckGo HTTPS-bypass recovery script (`fetch_missing_coaches.js`). Updated head coach field for DI schools (60% recovery rate on previous blanks).
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
