# Project Status: NCAA Baseball Camps 2026 Directory

## Current State: Stable & Deployed (Dynamic Rendering Production, Epoch Sort Fix)

The project is live with 559 NCAA Division I & II baseball programs. Production `index.html` is now a ~64KB dynamic shell that fetches `camps_data.json` at runtime (~99% size reduction vs the previous 5.4MB inline bundle). The static 5MB inline bundle is preserved as `index_1.html` via `generate_html_backup.js` for emergency fallback.

## Active Status:

| Metric             | Status                                                                                 |
| :----------------- | :------------------------------------------------------------------------------------- |
| **Total Programs** | 559 (DI + DII)                                                                         |
| **Engine Status**  | Stable — extraction available on-demand                                                |
| **Data Integrity** | High (Verified via sub-page depth & strict alias checks)                               |
| **Live Site**      | [bmwseals.com/Baseball_Camps_2026/](https://bmwseals.com/Baseball_Camps_2026/)         |
| **Dev Site**       | [bmwseals.com/Baseball_Camps_2026_dev/](https://bmwseals.com/Baseball_Camps_2026_dev/) |

## Architecture:

The pipeline reads from a single source of truth — `camps_data.json`:

1. **Extraction** → `smart_extract.js` calls V6 Puppeteer engine, writes to `camps_data.json`
2. **Verification** → `auto_verify.js` validates URLs; `verify_human.php` handles community votes
3. **Generation** → `generate_html.js` reads JSON and produces `index.html` (~64KB dynamic shell with runtime fetch); `generate_html_backup.js` produces `index_1.html` (~5MB static fallback)
4. **Word Export** → `src/utils/generate_word_doc.js` produces `NCAA-Baseball-Camps-2026.docx` from same JSON
5. **Deploy** → `deploy.js` uploads `index.html` + `camps_data.json` via FTP to production; `deploy_dev.js` to staging

## Word Document Status:

The Word document (`NCAA-Baseball-Camps-2026.docx`) is generated from `camps_data.json` via `src/utils/generate_word_doc.js`. It produces a table with all 559 programs. It is included in the `npm run full-update` pipeline. Consider removing if no longer needed for offline reference.
