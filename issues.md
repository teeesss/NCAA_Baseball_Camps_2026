# NCAA Baseball Camp Directory 2026 - Known Issues & Audits

## ✅ Resolved: V10 Centralization & Data Hardening (2026-04-07)

- [x] **Consolidated Extraction Fragmentation**: Fixed the 4-version drift across V7, V8, V9, and legacy scripts by building `src/utils/extraction_engine.js`.
- [x] **Config Synchronization Audit**: Resolved 16 global drift points (timeouts, regex) by centralizing all constants into `src/utils/config.js` and enforcing them with `test_config_consistency.js`.
- [x] **Surgical Data Purge**: Purged 9 definitive "bad data" records that held sport-contaminated (football, tickets) or stale 2025 information.
- [x] **Price Integrity Baseline**: 100% of the 559 records now pass `test_price_integrity.js`. Gonzaga and SWOSU updated with real 2026 data.

## ⚠️ Architectural Issues

### Puppeteer Timeout on Heavy Athletics Pages (2026-04-05)

- **Problem**: Sites like `ukathletics.com/camps` return "Navigation timeout of 25000 ms exceeded" even though the page loads fine in browser and contains real camp data.
- **Root cause**: `waitUntil: "networkidle0"` waits for ALL network connections to idle — athletics sites load ads, analytics, carousels endlessly.
- **Fix planned**: Switch to `"domcontentloaded"` + manual 3s render wait, increase timeout to 45s. See `task1.md` for full details.

### High-Performance Fetch Failure (2026-04-04)

- **Problem**: 35KB Dynamic Skeleton failed to render program records with "DOM Failed" error.
- **Cause**: The production `camps_data.json` was not uploaded, causing a 404 fetch error. Simultaneously, `human_verifications.json` was also missing on the server, causing a `Promise.all` rejection.
- **Rollback**: Restored the 5.4MB static `index.html` to guarantee 100% immediate production uptime.
- **Resolution Plan**: High-Performance rendering will be re-migrated to an isolated `/Baseball_Camps_2026_dev/` staging folder for rigorous verification before final production promotion.

## ⚠️ Data Integrity Issues

### Bogus $1 Prices from Extraction Engine (2026-04-05) — FIXED

- **Problem**: Schools like Slippery Rock showed `$1` camp pricing when the actual price from the source URL (`https://register.ryzer.com/camp.cfm?id=326042`) was `$294.00 / $215.00`.
- **Root cause**: The extraction regex `/\\$\\d+/` on line 188 of `extract_camp_details.js` only captured the first `$` digit sequence, so `$294.00` was extracted as `$2`, `$1,000` as `$1`, etc. Additionally, some Ryzer page HTML artifacts contain stray `$1` references (likely deposit/fee separators).
- **Fix**: Regex upgraded to `/\\$[\\d,]+(?:\\.\\d{2})?/` to capture full dollar amounts including commas and decimals. Added a $5 minimum threshold — any extracted price under $5 is rejected and set to "TBA". 30 suspicious entries purged from `camps_data.json`. Slippery Rock manually corrected to $294/$215 from the verified URL.
- **New test**: `src/tests/test_price_integrity.js` scans the master JSON for any price under $5. It has a `--fix` flag to auto-replace with "TBA". **MANDATORY**: Run `npm run test` (which includes price + config + UI filter tests) before ANY deploy, push, or HTML regeneration. The `full-update` and `update` npm scripts now include the price test automatically. See CLAUDE.md rule: "Mandatory Test Suite".

### Cross-School Email Contamination Detection (2026-04-05) — FIXED

- **Problem**: Schools had emails from OTHER schools in their records (e.g. FSU with gators@ufl.edu).
- **Fix**: Created `src/tests/test_data_contamination.js` — builds a .edu domain ownership index from the data itself and flags any school whose email/contact domain belongs to a DIFFERENT school (with substring pair exclusion for Alabama/Alabama State etc). Caught and fixed 2 real contaminations.
- **Wired into pipeline**: `npm test` now includes this check. `full-update` and `update` scripts run it automatically.

### Cross-School Email Contamination (2026-04-05) — FIXED (data cleaned)

- **Problem**: The extraction engine appended emails from OTHER schools to the `contact` field (e.g., Florida State had `gatorsbaseballcamps@ufl.edu`).
- **Root cause**: The cross-school email check only validates the extracted `email` field, but the `campPOC` regex captures POC + email strings containing wrong-school emails.
- **Fixed records**: Florida State → "Link Jarrett", North Florida → "Joe Mercadante"
- **Future fix**: Add cross-school email validation in `campPOC` extraction (see `task1.md`)

## ⚠️ UI/UX Issues

### "Visit Site" Button Renders Raw HTML Attributes as Text Content (2026-04-07) — FIXED

- **Symptom**: Cards without a valid camp URL showed the Visit Site button text as `style="opacity:0.3;cursor:not-allowed;" onclick="return false">Visit Site`. Cards WITH a URL showed `>Visit Site` (stray `>` prepended to the label).
- **Root cause**: The `<a>` tag for the Visit Site button was opened AND closed in the first string concatenation — `' target="_blank" onclick="event.stopPropagation()">'` — which emits the closing `>` of the tag's opening bracket. Then a ternary expression was concatenated *after* that already-closed tag. Both branches of the ternary were designed to inject HTML attributes + the closing `>`, but since the tag was already closed they instead became raw text content *inside* the `<a>`. For the disabled branch: `style="opacity:0.3...">Visit Site` was literally the button label. For the enabled branch: `>Visit Site` became the visible text with the stray `>`.
- **Fix**: Restructured the Visit Site block so each branch of the ternary emits a *complete, self-contained `<a>` tag string* — attributes, closing `>`, label, and `</a>` — with no shared prefix. Added a `// DO NOT BREAK` guard comment.
- **Files fixed**: `generate_html.js` (line ~670) and `generate_html_dev.js` (line ~668). Both generators were identical in this bug.
- **Prevention rule**: When building HTML strings via string concatenation with a ternary, NEVER close the opening tag (`>`) in a shared prefix and then inject attributes in a ternary branch. Always build each conditional variant as a complete, standalone HTML element string.



### Favicon Console Bloat (gstatic 404)

- **Problem**: Google's Favicon V2 service is returning 404 for ~12 outdated university domains, cluttering the browser console.
- **Root Cause**: Many NCAA DII program sites use legacy/dormant domains from the early 2010s that lack current FAVICON support.
- **Temporary Fix**: Adding `onerror="this.style.display='none'"` to the logo/icon container to suppress visual broken icons.
- **Permanent Fix**: Implement a custom icon-caching service to proxy and verify school favicons from the backend during extraction.

### Arkansas/Auburn Detail Desync

- **Problem**: Camp dates on the card (Main Page) were not synchronized with the data presented inside the Modal (Details).
- **Cause**: Discrepancy between `camps_data.json` entry and `details` field parsing.
- **Resolution**: Use a single authoritative source for both views to eliminate data drift.

### Date Sort Broken on Latest Camp Dates / Latest Updates (2026-04-06) — FIXED & VERIFIED ON LIVE

- **Problem**: "Latest Camp Dates" and "Latest Updates" tabs showed alphabetical order instead of newest-first.
- **Root cause**: Someone "fixed" the alphabetical re-sort for the "All" view by adding a guard condition `&& term === '' && costFilter === 'all' && confFilter === 'all'` to the date-sort branch. This caused the date sort to ONLY fire when ALL filters were empty, which is almost never the initial state. The alphabetical `else` branch ran instead, showing wrong order.
- **Fix**: Removed the extra guard conditions. Date sort now triggers whenever `currentDiv` is `'updates'` or `'newdates'`, period. The alphabetical sort runs in all other cases. Also upgraded from `localeCompare` (string comparison) to `Date.parse()` (numeric comparison) for proper ISO timestamp ordering. **Fix documented in CLAUDE.md, GEMINI.md, and in-code comments ("DO NOT BREAK").**
- **Applied to**: `generate_html.js` (line ~1065) and `generate_html_dev.js` (line ~878).
- **Prevention**: Both generators carry a prominent "DO NOT BREAK" comment. If you change sort logic, ALWAYS test: (1) click "All" → verify alphabetical, (2) click "Latest Camp Dates" → verify newest-first, (3) click "Latest Updates" → verify newest-first, (4) search + switch back to "All" → verify alphabetical.
- **Verified on live server 2026-04-06**: All three sort modes pass (All = A-Z, Latest Camp Dates = newest-first by `data-dates-update`, Latest Updates = newest-first by `data-last-update`)

### "All" Button Re-Sort Regression (2026-04-06) — FIXED

- **Problem**: After fixing the date tabs (removing extra guard conditions), clicking "All" stopped re-sorting alphabetically — it kept the previous sort order from "Latest Camp Dates" or "Latest Updates."
- **Root cause**: When "All" is clicked, `currentDiv` is set to `'all'` (not `''`). The date-sort condition `if (currentDiv === 'updates' || currentDiv === 'newdates')` correctly falls through to the `else` branch. But the `else` branch needs to actually re-sort and re-append cards in alphabetical order. This was already in place — the issue was that the previous "fix" attempt had added a bare `\ CRITICAL:` (missing `//` comment prefix) in the dev generator, causing a JavaScript syntax error that silently broke ALL filtering.
- **Fix**: Removed the syntax error (`\ CRITICAL:` → `// CRITICAL:`) in `generate_html_dev.js` line 876. The `else` branch correctly sorts alphabetically via `ua.localeCompare(ub)`.
- **Verified**: Full cycle test — "All" (A-Z) → "Latest Camp Dates" (newest) → "Latest Updates" (newest) → "All" (A-Z again) — all pass.
- **CRITICAL RULE**: The sort branch condition must ONLY be `if (currentDiv === 'updates' || currentDiv === 'newdates')`. NEVER add extra conditions. NEVER use bare `\` instead of `//` for comments — it causes silent JS syntax errors that kill all filtering.

## ✅ Verified Resolutions

### Texas Cost Missing `$` Prefix (2026-04-06) — FIXED

- **Problem**: Texas entry had cost `485 | 190 | 190 | 485 | 190 | 190 | 485 | 190 | 190 | 485 | 485 | 100 | 150 | 200 | 100 | 150 | 200` — all 17 price values missing `$` prefix
- **Root cause**: Extraction engine captured numeric values without the leading `$` from the original page
- **Fix**: Manually corrected to `$485 | $190 | $190 | $485 | $190 | $190 | $485 | $190 | $190 | $485 | $485 | $100 | $150 | $200 | $100 | $150 | $200`
- **Prevention**: Added rule to CLAUDE.md and GEMINI.md: extraction regex must always capture `$` with digits. `test_price_integrity.js` updated to detect and auto-fix bare numbers.

### "Lost Tiers" — 36 Schools Have Dates/Cost But Empty campTiers (2026-04-07) — INVESTIGATED

- **Problem**: 36 schools (Alabama, Alabama A&M, Alabama State, Appalachian State, Arizona, etc.) have populated `dates` and `cost` fields but `campTiers: []` (empty array). The UI only shows 3 dates on the Texas card instead of all 13 sessions.
- **Root cause**: The extraction engine's `extractDataFromText()` DOES correctly populate `campTiers`, but a subsequent pipeline step (likely `finalize_database.js` or a merge/normalize script) overwrites the array. The flat `dates = [...new Set(tiers.map(t => t.dates))].join(" | ")` string survives but the tiers array is lost.
- **Fix (Texas)**: Manually reconstructed all 13 session tiers from the official Texas Longhorns page with full name, dates, cost, time, and ages for each session.
- **Systemic fix needed**: All 36 schools with lost tiers require targeted re-extraction via `smart_extract.js --school="A,B,C" --force` or a batch audit/recovery script.
- **Impact**: ~7% of schools (36/521) are missing granular session data that the site displays.

### Email Not Displaying in UI (2026-04-07) — FIXED

- **Problem**: The UI showed "Check site for contact info" for almost every school, even when a valid email existed in the database (e.g., Alabama's `bamabaseball@ia.ua.edu`).
- **Root cause**: `generate_html.js` checked only `item.campPOCEmail` for email display, but the V10 extraction engine saves emails to `item.email`. The `campPOCEmail` field was created during a contact normalization migration but is NEVER populated by the extraction engine.
- **Fix**: Both card-level `contactEmail` and modal-level `emailHtml` in `generate_html.js` now use `item.campPOCEmail || item.email || ''` fallback chain.

### POC Name Not Extracted from Page Text (2026-04-07) — FIXED

- **Problem**: Pages that say "Email Drew Bishop at Drew.Bishop@athletics.utexas.edu" lost the POC name "Drew Bishop" — only the email was captured.
- **Root cause**: `harvestEmails()` only matches the regex for the email address itself. `getCoachName()` only reads existing record fields, it doesn't parse page text for new names.
- **Fix**: Added `extractNameNearEmail()` in `extraction_engine.js` with 4 regex patterns for contextual name extraction. The contact merge logic now calls this as a fallback when `pointOfContact` is N/A.

- **Alabama A&M String Collision**: Resolved the "Alabama" substring match bug that was misapplying Auburn/Alabama HC data to AL State.
- **Cost Filter Decimal Parsing**: Fixed the regex bug that was failing to categorize camps with $0.50 increments (e.g., $262.50).
- **Arizona TBA/Dates Desync**: Corrected the logic that showed TBA in details while show valid dates on the card front.
- **Filter Sort Reversion**: Fixed bug where clicking "All" after "Latest Updates" kept date-sorted order instead of returning to alphabetical. Root cause: `campsContainer` was undefined in production code, and no re-sort existed for non-date views. Fix adds `campsContainer` reference and explicit alphabetical re-sort in the `else` branch.
- **Date Sort Broken by Extra Conditions (2026-04-05)** — FIXED: The "Latest Camp Dates" and "Latest Updates" tabs failed to sort by newest-first. Root cause: the date-sort branch had an extra guard `&& term === '' && costFilter === 'all' && confFilter === 'all'` that caused the sort to fall through to the alphabetical `else` branch whenever ANY filter was active OR on initial page load. Fix: removed the extra guard conditions so date-sort always applies when `currentDiv` is `'updates'` or `'newdates'`. Also upgraded from `localeCompare` to numeric `Date.parse()` comparison for proper ISO timestamp ordering. Applied to both `generate_html.js` and `generate_html_dev.js`. **IMPORTANT: Never add filter conditions to the date-sort branch — it will break descending date order. The date-sort condition should ONLY check `currentDiv`.**

## ✅ Recently Audited (2026-04-05)

### Puppeteer Timeout Pattern — FIX VALIDATED (not merged to main yet)

- **Affected schools**: 18+ timeouts in a single run including Kentucky, South Carolina, Auburn, Cincinnati, Minnesota State, Washington, Mississippi Valley State, Evansville, Santa Clara, BYU, Auburn, Georgetown, and others.
- **Root cause**: `waitUntil: "networkidle0"` + 25s timeout + no StealthPlugin.
- **Fix validated**: Switched `smart_extract.js` to `puppeteer-extra` + `StealthPlugin`, changed all `networkidle0` → `domcontentloaded`, increased timeout to 45s. Ran on 23 schools from the timeout queue — **zero timeouts, 6 schools gained new data**. Fix reverted from main for now (documented in `task1.md`). Re-apply before next extraction run.

### Non-Timeout ERR\_ Failures

- **Rutgers**: `net::ERR_ABORTED` on PDF flyer (scarletknights.com). Not a real error — Chrome treats PDFs as downloads. Data already captured.
- **New Mexico**: `net::ERR_CERT_COMMON_NAME_INVALID` on `summercampsnavigator.com`. Bad SSL cert on third-party camp aggregator.
- **UC Davis**: `net::ERR_CERT_COMMON_NAME_INVALID` on `ucdavisbaseballcamps.totalcamps.com`. Same root cause — third-party camp platform with misconfigured SSL.

### URL Validator Fixes — isCampRelatedUrl Gaps (2026-04-06 Session 2)

- **Problem**: `isCampRelatedUrl()` in `src/utils/url_validator.js` was too strict. It rejected `/sports/baseball` paths on official athletics domains (e.g. `goarmywestpoint.com/sports/baseball`) and playnsports.com organization URLs, clearing 235 valid campUrl entries. Per CLAUDE.md: "100% of programs must have a valid camp registration URL or athletic department baseball URL."
- **Fix**: Updated `isCampRelatedUrl()` to accept `/sports/baseball` as a valid fallback path. Added known camp platform exemptions (playnsports.com, totalcamps.com, summercampsnavigator.com) for `/organization/` paths. Restored 42 school URLs (36 playnsports + 6 .edu athletics).
- **Camp URL coverage**: 331/521 (64%) — 190 still missing (all DII, no posted camp pages — expected per "DII Scarcity Awareness" rule).
- **Tests**: 52/52 PASS after fix. HTML regenerated.
- **Files modified**: `src/utils/url_validator.js`, `camps_data.json`, `generate_html.js`.

## ✅ Contact Info Consolidation (2026-04-06 Session 3) — FIXED

### Duplicate Contact/Email Fields Eliminated

- **Problem**: 4 overlapping contact-related fields (`contact`, `email`, `campPOC`, `headCoach`) caused duplication, inconsistent formats, and cross-contamination risk. The `contact` field stored mixed data: names only, emails only, or "Name | email@domain" strings. The `email` field duplicated emails already present in `contact` or `campPOCEmail`.
- **Fix**: Eliminated `contact` and `email` fields entirely. Schema now has exactly 3 authoritative fields:
  - `campPOC` — camp organizer name only (First Last), 352/521 populated (68%)
  - `campPOCEmail` — email address only, 218/521 populated (42%)
  - `headCoach` — school's head baseball coach, 419/521 populated (80%)
- **Migration**: All 521 records processed. "Name | email" strings split into separate fields. Email-only contacts → campPOCEmail. Names extracted from name-only entries → campPOC. Old fields deleted from all records.
- **Scripts Updated (10 files)**: `generate_html.js`, `generate_html_dev.js`, `extract_camp_details.js`, `extract_verify.js`, `generate_word_doc.js`, `finalize_database.js`, `smoke_test.js`, `spot_check.js`, `audit_data_integrity.js`.
- **New scripts**: `normalize_contacts.js` (migration), `src/utils/fetch_head_coaches.js` (Wikipedia head coach lookup), `src/utils/clean_remaining_issues.js` (automated bulk cleanup).

### Data Cleanup Issues Resolved

- **Duplicate emails in campPOCEmail (Longwood)**: `tophamk@longwood.edu | lindsem@grace.edu` contained two emails. Split on `|`, kept school-domain match → `tophamk@longwood.edu`.
- **2025 date contamination (Longwood)**: `6/6/2025` in dates field. Removed 2025-only dates, kept 2026.
- **Non-baseball camp tiers (114 entries across 14 schools)**: Extraction picked up Piano Camp, Soccer Showcase, Ice Hockey Clinic, Band Camp, etc. from multi-sport athletics pages. Purged tiers containing non-baseball keywords (piano, soccer, hockey, band, softball, swimming, tennis, wrestling, volleyball, basketball, football, gymnastics, cheer, lacrosse).
- **$1 placeholder prices (10 schools, 19 tier entries)**: Ball State, NJIT, Seton Hill, Slippery Rock, Southern NH had `$1` or `$1.00` registration placeholders from playnsports/ryzer pages. Set to TBA.
- **Garbage headCoach values (4 entries)**: Team names like "Oklahoma Sooners", "Minnesota State Mavericks" sneaked through Wikipedia extraction as head coach names. Cleaned to N/A.

### Wikipedia Head Coach Lookup

- **Purpose**: Populate `headCoach` field for schools lacking coach data.
- **Method**: Searched Wikipedia API for "{school} baseball head coach", matched person-name page titles (e.g. "Nick Mingione") containing "coach" in snippet.
- **Results**: 276 schools processed, 178 found, 98 not found (4 garbage cleaned).
- **Coverage**: 419/521 schools now have head coach data (80%). The 98 remaining are mostly DII programs without Wikipedia pages.

### Final Surgical Cleanup (2026-04-07) - FIXED

- **Gonzaga**: Price under $5 ($1) confirmed as part of a multi-tier youth "Pups" camp. Verified URL and updated to correctly reflect 2026.
- **SW Oklahoma State**: Redirect was taking scraper to football camp. Corrected to official baseball portal.
- **Purged Junk**: Purged NJIT (basketball/tickets), Southeastern OK (football), St. Cloud State (basketball), Texas Southern (2025 only), Western Michigan (no events), Metro State Denver (basketball).
- **Verified Guards**: Added `isVerified` check to `test_price_integrity.js` so it no longer flags valid, human-confirmed prospect camps that happen to have a low-cost tier.

### Remaining Issues from Audit

- **Conflicting dates/details (3 schools)**: Richmond, Ouachita Baptist, Thomas Jefferson have dates but details say "No 2026 camps posted" — flagged for manual review.
- **FREE cost markers (4 schools)**: Valparaiso, Assumption, Winthrop, Barry have "FREE" or "Free" cost entries — likely intentional for demo/elementary camps.
- **382 empty sourceUrl fields**: Low priority — `campUrl` is the primary link used in UI.
- **98 schools missing head coaches**: Wikipedia couldn't find them (mostly DII) — alternate sources needed (NCAA.org, school athletics rosters, or manual lookup).
- **Word export decision**: Whether to regenerate or deprecate `NCAA-Baseball-Camps-2026.docx`.
