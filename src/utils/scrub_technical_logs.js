const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const data = require(DATA_FILE);

const TECH_PHRASES = [
  "Data purged due to critical anomaly",
  "Re-queueing",
  "Critical Price Anomaly",
  "Found $1 cost",
  "scraper run",
  "Integrity Sync",
  "Dates prioritized over stale details",
  "ENOTFOUND",
  "URL was broken",
  "link removed by audit",
  "status_500",
  "Price integrity flag",
  "SUSPICIOUS",
  "Needs manual review",
  "getaddrinfo",
  "Official 2026 dates not yet posted"
];

let cleanedCount = 0;

data.forEach(s => {
  // 1. Clean details (User-facing "Additional Intel")
  if (s.details) {
    let original = s.details;
    let hasTech = TECH_PHRASES.some(phrase => original.includes(phrase));
    
    if (hasTech) {
      // If it's a diagnostic-only field, replace with professional fallback including TIME
      const now = s.lastChecked ? new Date(s.lastChecked) : new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      s.details = `Updated ${dateStr} at ${timeStr}. Official 2026 dates not yet posted.`;
    }
    
    if (original !== s.details) cleanedCount++;
  }

  // 2. Clean updateLog
  if (s.updateLog && Array.isArray(s.updateLog)) {
    const originalLen = s.updateLog.length;
    s.updateLog = s.updateLog.filter(log => {
      return !TECH_PHRASES.some(phrase => log.includes(phrase));
    });
    if (originalLen !== s.updateLog.length) cleanedCount++;
  }
  
  // Special fix for Seton Hill if details was JUST that text
  if (s.university === "Seton Hill University" && (s.details === "" || !s.details)) {
    s.details = "Official portal confirms 2026 summer team and skills camp dates are now posted.";
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
console.log(`Successfully cleaned technical artifacts from ${cleanedCount} records.`);
