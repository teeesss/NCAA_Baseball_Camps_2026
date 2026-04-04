# NCAA Baseball Camp Directory 2026 - Known Issues & Audits

## ⚠️ Architectural Issues
### High-Performance Fetch Failure (2026-04-04)
- **Problem**: 35KB Dynamic Skeleton failed to render program records with "DOM Failed" error. 
- **Cause**: The production `camps_data.json` was not uploaded, causing a 404 fetch error. Simultaneously, `human_verifications.json` was also missing on the server, causing a `Promise.all` rejection.
- **Rollback**: Restored the 5.4MB static `index.html` to guarantee 100% immediate production uptime.
- **Resolution Plan**: High-Performance rendering will be re-migrated to an isolated `/Baseball_Camps_2026_dev/` staging folder for rigorous verification before final production promotion.

## ⚠️ UI/UX Issues
### Favicon Console Bloat (gstatic 404)
- **Problem**: Google's Favicon V2 service is returning 404 for ~12 outdated university domains, cluttering the browser console.
- **Root Cause**: Many NCAA DII program sites use legacy/dormant domains from the early 2010s that lack current FAVICON support.
- **Temporary Fix**: Adding `onerror="this.style.display='none'"` to the logo/icon container to suppress visual broken icons.
- **Permanent Fix**: Implement a custom icon-caching service to proxy and verify school favicons from the backend during extraction.

### Arkansas/Auburn Detail Desync
- **Problem**: Camp dates on the card (Main Page) were not synchronized with the data presented inside the Modal (Details).
- **Cause**: Discrepancy between `camps_data.json` entry and `details` field parsing.
- **Resolution**: Use a single authoritative source for both views to eliminate data drift.

## ✅ Verified Resolutions
- **Alabama A&M String Collision**: Resolved the "Alabama" substring match bug that was misapplying Auburn/Alabama HC data to AL State.
- **Cost Filter Decimal Parsing**: Fixed the regex bug that was failing to categorize camps with $0.50 increments (e.g., $262.50). 
- **Arizona TBA/Dates Desync**: Corrected the logic that showed TBA in details while show valid dates on the card front.
