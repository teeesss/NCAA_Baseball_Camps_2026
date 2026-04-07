# Task 2: Fix Sub-Crawl Cross-School Contamination (2026-04-05)

## Critical Production Bug

### What Happened

`smart_extract.js` was scraping **other schools' camp pages** and dumping their data (emails, costs, dates, URLs) onto the wrong records in `camps_data.json`.

### Real Examples

| School             | Wrong Data                          | Actually Belongs To       |
| ------------------ | ----------------------------------- | ------------------------- |
| Eastern New Mexico | `everett@jsu.edu` + $100/$105/$150  | Jacksonville State        |
| Lafayette          | `baseball@ewu.edu` + $125/$133/$150 | Eastern Washington        |
| Le Moyne           | `burrk2@erau.edu` + $150/$200       | Embry-Riddle Aeronautical |

### Root Cause

Line 546 in `smart_extract.js` — the sub-crawl loop merges ANY sub-page containing the word "baseball" into `fullText` with **zero cross-school validation**:

```js
if (subText && subText.toLowerCase().includes("baseball")) {
  fullText += "\n" + subText; // ← No contamination check!
}
```

## What Was Done

### 1. Fixed the code — added 3 layers of contamination guards

Each sub-page URL is now checked before merging into `fullText`:

1. **URL hostname check** — if the sub-page's hostname clearly belongs to another school, skip it
2. **Name/mascot text contamination** — `checkSubPageContamination()` scans for other school names and mascots
3. **Email contamination** — scans extracted emails and cross-checks against MASCOT_LOOKUP for wrong-school email addresses

### 2. Updated test suite

Added 3 new test cases to `src/tests/test_contamination_check.js`:

- Test 7: Le Moyne contaminated by ERAU email (no name overlap)
- Test 8: Lafayette contaminated by EWU via same-platform sublink
- Test 9: Verify own-school text does NOT falsely contaminate

All 9 tests pass. Test file runs cleanly.

### 3. Restored corrupted production data

Restored Eastern New Mexico from backup (`camps_data_backup_1775353246398.json`). Lafayette and Le Moyne records were clean in production (wrong data was only in extraction log, not yet written to DB at time of kill).

No remaining contamination emails found in production (`grep @jsu|@ewu|@erau` returned zero results).

## Cleanup Completed

| File                                | Action                   | Reason                                                                                       |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `!playnsports_clean.json`           | Deleted                  | Exact duplicate of `!playnsports_fixed.json`                                                 |
| `src/utils/authoritative_urls.json` | Created                  | Merged BCUSA (295) + PlayNSports (153) + TotalCamps (31) = 479 unique records, source-tagged |
| 9 merge/parse scripts               | Moved to `src/archives/` | One-off BCUSA, playnsports, baseballcampsusa merge iterations                                |
| 2 logs                              | Moved to `logs/`         | `deep_url_audit.log`, `smart_extract_live.log`                                               |
| 2 dead data files                   | Moved to `src/archives/` | `missing_investigate_queue.txt`, `unis.txt`                                                  |
| 7 redundant backups                 | Deleted                  | Kept oldest (pre-fix baseline) + newest (current state)                                      |

## Remaining Issues

### smart_extract.js still uses old Puppeteer config

The `puppeteer-extra` + `StealthPlugin` + `domcontentloaded` + 45s timeout fix (from task1.md) was reverted from main. It was validated on 23 schools with zero timeouts but not merged back. **Must be re-applied before next run.**

### Still need to:

1. Re-apply the StealthPlugin/timeout fix from task1.md
2. Remove the duplicate inline `checkSubPageContamination` function and use the shared `contamination_check.js` utility instead (or merge the two)
3. Run `node generate_html.js` to regenerate HTML with cleaned data
4. Run `node src/tests/test_ui_filter.js` and `node src/tests/test_config_consistency.js` before any deploy
5. Check remaining corrupted records (if any) from the brief contamination window

## Rules Reminder

- **ALWAYS run tests after any code change** before running production scripts
- **ALWAYS add test cases when a bug is discovered** that catch the exact scenario
- **NEVER run `smart_extract.js` on production without test validation**
- **Test scripts ARE production** — they catch bugs before they corrupt the database
- All contamination guards: URL hostname, name/mascot overlap, email domain, and `isContaminated()` from `src/utils/contamination_check.js` must all pass before merging sub-page content
