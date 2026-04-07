# Project Status: NCAA Baseball Camps 2026 Directory

## Current State: V10 Engine Consolidated & 100% Data Integrity Baseline

The project is live with 559 NCAA Division I & II baseball programs. Production `index.html` is now a ~64KB dynamic shell that fetches `camps_data.json` at runtime (~99% size reduction vs the previous 5.4MB inline bundle). The static 5MB inline bundle is preserved as `index_1.html` via `generate_html_backup.js` for emergency fallback.

## Active Status:

| Metric             | Status                                                                                    |
| :----------------- | :---------------------------------------------------------------------------------------- |
| **Total Programs** | 559 (DI + DII)                                                                            |
| **Engine Status**  | **V10 Unified** — Authorized shell delegates to `src/utils/extraction_engine.js`          |
| **Data Integrity** | **100% BASELINE** (Verified via `test_price_integrity.js` & `test_config_consistency.js`) |
| **Live Site**      | [bmwseals.com/Baseball_Camps_2026/](https://bmwseals.com/Baseball_Camps_2026/)            |
| **Dev Site**       | [bmwseals.com/Baseball_Camps_2026_dev/](https://bmwseals.com/Baseball_Camps_2026_dev/)    |

## Architecture:

The pipeline reads from a single source of truth — `camps_data.json`:

1. **Extraction** → `smart_extract.js` (thin shell) calls **V10 Unified Engine** (`src/utils/extraction_engine.js`), writes to `camps_data.json`.
2. **Verification** → `auto_verify.js` (archived, now integrated into V10); `verify_human.php` handles community votes.
3. **Generation** → `generate_html.js` (production) produces `index.html` (~64KB dynamic shell with runtime fetch).
4. **Consistency** → `test_config_consistency.js` enforces 16 global tokens from `src/utils/config.js`.
5. **Deploy** → `deploy.js` (production) and `deploy_dev.js` (staging) sync to FTP.

## Word Document Status:

The Word document (`NCAA-Baseball-Camps-2026.docx`) is generated from `camps_data.json` via `src/utils/generate_word_doc.js`. It produces a table with all 559 programs. It is included in the `npm run full-update` pipeline. Consider removing if no longer needed for offline reference.
