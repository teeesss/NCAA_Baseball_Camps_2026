# NCAA Baseball Camps 2026 Directory: Quickstart

A summary of how to use and run the project components for local development and data gathering.

## Getting Started
1. **Node.js**: Ensure Node.js (version 18+) is installed.
2. **Dependencies**: Run `npm install` in the project root.

## Background Extraction
To start the automated background extraction monitor:
```powershell
node watchdog.js
```
This script will:
- Launch `extract_camp_details.js` in a continuous loop.
- Automatically restart the process if it becomes inactive or crashes.
- Monitor the `extraction_all.log` for real-time status updates.

## Local Directory Verification
To view the resulting directory locally:
```powershell
# Open index.html in a web browser.
# Or use a local development server:
npx live-server
```

## Data Cleanup & Merging
To manually process and merge updated camp data into the JSON database:
```powershell
node finalize_database.js
```
This script will:
- Process the extraction results.
- Deduplicate entries.
- Map the data into the final `camps_data.json` format.

## Deployment Process
Follow the `/deploy` workflow to build, commit, and sync the project to the live web server.
- Build: `npm run build`
- Deploy: `npm run deploy`
- Live URL: `https://bmwseals.com/Baseball_Camps_2026/`
