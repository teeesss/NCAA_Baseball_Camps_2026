# NCAA Baseball Camps Directory 2026 — Issues Log

This document serves as the permanent record for technical debt, regressions, and cross-contamination issues to prevent process loops and data decay.

## Active Issues

| Issue ID | Date Reported | Component | Severity | Description | Status | 
|:---|:---|:---|:---|:---|:---|
| **ISS-001** | 2026-04-03 | Data Integrity | High | SEC Verification Regression: Multiple SEC teams (Alabama, Arkansas, etc.) had their `isVerified` status reset to false and conference tags cleared. | **RESOLVED** |
| **ISS-002** | 2026-04-03 | UI - Filters | Medium | Conference filter dropdown 'More Conferences' deemed clunky and unnecessary. User requested single-line wrap. | **RESOLVED** |
| **ISS-003** | 2026-04-03 | Data Mapping | Medium | Notre Dame misclassified or left untagged. Confirmed ACC status for 2026. | **RESOLVED** |
| **ISS-004** | 2026-04-03 | Search Loop | High | Circular Logic: Scraper was re-auditing schools with thin data but skipping the search fallback, leading to infinite "PASS" results with no new data. | **RESOLVED** |
| **ISS-005** | 2026-04-03 | Mascot Collision | Medium | Mascot "Knights" collision between UCF and Bellarmine causing false "CROSS-SCHOOL" rejections. | **RESOLVED** |
| **ISS-006** | 2026-04-04 | Data Quality | Medium | Legacy data (2025) and "Team Camp" pages polluting pricing and date fields. | **RESOLVED** |
| **ISS-007** | 2026-04-03 | Extraction | High | llm-issues-prompt.md: 5 validation gaps — missing sport exclusivity, year prioritization, baseball-context email, team-camp cost filtering, and search result validation in smart_extract.js. | **RESOLVED** |

---

## Resolution Archive

### **ISS-001: SEC Verification Regression**
- **Symptom**: 8+ SEC teams reverted to 'Not Verified' and 'Other' conference.
- **Cause**: Automated extraction script likely overwrote records with lower-fidelity search results because the `isVerified` check was bypassed or the school name matching failed.
- **Resolution**: Created `src/utils/restore_data_integrity.js` to bulk-apply `isVerified: true` and `conference: "SEC"` for fixed SEC programs using `verified_records.json` as a secondary source of truth.
- **Prevention**: Updated `EXTRACTION_ENGINE.md` and user global rules to enforce `scriptVersion` checks. Scripts MUST skip any school where `isVerified === true` and `scriptVersion >= 5`.

### **ISS-002: Conference Filter UI Refactor**
- **Symptom**: Dropdown for 'Other' conferences was hidden and hard to use.
- **Resolution**: Modified `generate_html.js` to remove `majorConferences` subsetting. All conferences now render as buttons in a `flex-wrap` container. Renamed 'Independent / Other' to 'Other'.
- **Result**: Cleaner, faster access to D2 and Mid-Major conferences.

### **ISS-003: Notre Dame Conference Mapping**
- **Symptom**: User noted Notre Dame was missing ACC tag.
- **Resolution**: Updated `src/utils/conference_lookup.js` and ran `restore_data_integrity.js` to force Notre Dame -> ACC.

### **ISS-004: Audit Loop & Thin Data Fallback**
- **Symptom**: DI schools with "TBA" dates were being marked as "isChecked: true" and skipped in subsequent runs, but never improved.
- **Resolution**: Updated `deep_url_audit.js` queue filter to force a re-audit if `dates === "TBA"` or `auditStatus` was a failure code. Implemented Phase 3 "Deep Search" that triggers if Phase 1/2 fail.
- **Prevention**: Persisting `auditStatus` to `camps_data.json` so the next pass knows to use Deep Mode.

### **ISS-005: Mascot Collision (Knights)**
- **Symptom**: UCF (Knights) rejected its own official site because the script thought it belonged to Bellarmine (Knights).
- **Resolution**: Refined `validatePage` logic to ensure a mascot match for the *target* school is not treated as a cross-contamination error even if a competitor shares the mascot.

### **ISS-007: llm-issues-prompt.md Hardening (5 Gaps)**
- **Symptom**: `smart_extract.js` lacked sport exclusivity filtering, year prioritization in search, baseball-context email extraction, team-camp/legacy rejection, and search result validation scoring.
- **Root Cause**: The lightweight `smart_extract.js` engine was designed for speed, missing the deeper validation logic already present in `deep_url_audit.js`.
- **Resolution**: Applied 5 surgical fixes to `smart_extract.js`:
  1. **Sport Exclusivity**: Added `isWrongSport()` — rejects pages dominated by football/basketball/soccer/etc without any baseball context.
  2. **Year Prioritization**: Rewrote `searchEngine()` to score+rank results — 2026 URLs get +50 pts, 2025 URLs get -100 pts. Also rejects ticket/merchandise/wrong-sport URLs.
  3. **Baseball-Context Email**: Replaced raw full-page email extraction with section-aware filtering. Only extracts emails from sections mentioning "baseball" or "camp". Falls back to .edu-only emails from full page.
  4. **Team Camp / Legacy Filtering**: Added `isTeamCampOrLegacy()` — rejects pages that are team-camp-only or legacy 2025 pages.
  5. **Cost Floor**: Raised minimum from $0 to $100 (rejecting junk prices like $1, $50). Lowered repull threshold from $500 to $1500.
- **Test Coverage**: `src/tests/test_llm_issues.js` — 27 unit tests (6 groups) all passing.

