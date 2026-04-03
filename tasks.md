# Project Tasks: NCAA Division I Baseball Camps 2026 Compilation

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
- [ ] Deploy `verify_human.php` to live server at `https://bmwseals.com/Baseball_Camps_2026/verify_human.php`.
- [ ] Deploy empty `human_verifications.json` to live server (writable by PHP).
- [ ] Deploy empty `human_verifications_ip.json` to live server (writable by PHP).
- [x] Build `fetch_verifications.js` — syncs `human_verifications.json` from live server to local.
- [ ] Add **"👤 Human Verified"** button to each school card in UI.
  - Shows current count: `👤 3 People Verified This`.
  - On click: POSTs to `verify_human.php`, updates count inline.
  - If rate limited: shows friendly "You already verified — try again in ~Xh" toast message.
  - Stores voted-school list in `localStorage` to grey-out button after voting.
- [ ] Add `sync-verifications` as first step in `npm run full-update` pipeline.
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
- [x] Verify "Alabama vs Alabama State" and other substring-related contact data isolation (prevent cross-contamination).
- [ ] Implement robust link verification (batch HTTP GET) to ensure all existing `campUrl` records are alive (200 OK).

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
