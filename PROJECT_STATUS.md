# Project Status: NCAA Baseball Camps 2026 Directory

## Current State: V12.6 Engine Hardening & P0 Ryzer Portal Fix

The project is live with 559 NCAA Division I & II baseball programs. Production `index.html` is now a ~64KB dynamic shell that fetches `camps_data.json` at runtime.

The extraction engine is currently at **V12.6**, featuring **P0 Portal Bridge Fast-Track**, query-string preservation for session IDs, and `networkidle2` portal navigation.

## Active Status:

| Metric             | Status                                                                                    |
| :----------------- | :---------------------------------------------------------------------------------------- |
| **Total Programs** | 521 (Checked & Processed)                                                                 |
| **Active Portals** | **177** (Verified 2026 Tiers) | **361** (Total Found)                                    |
| **Engine Status**  | **V12.6 Hardened** — P0 Ryzer Portal Bridge Sync Completed                             |
| **UI Aesthetics**  | **Single-Row Multi-Mode** — Compact mobile-first design with independent scope/sort logic. |
| **Data Integrity** | **V12.5 BASELINE** (100% checked, institutional mismatch scrubbed) |
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
