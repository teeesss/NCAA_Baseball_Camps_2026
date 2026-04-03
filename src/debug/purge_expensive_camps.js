const fs = require('fs');

const DATA_FILE = 'x:/NCAA-DivisonI-Baseball-Camps-2026/camps_data.json';
let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

let count = 0;
let toProcess = [];
data.forEach(item => {
    if (!item.cost || item.cost === 'TBA') return;
    
    // We expect cost to look like "$150 / $400 / $1000"
    // Grab all prices, parse them as floats correctly
    let costMatches = item.cost.match(/\d+[\d,]*(?:\.\d{2})?/g);
    if (!costMatches) return;
    
    let prices = costMatches.map(c => parseFloat(c.replace(/,/g, '')));
    let maxPrice = Math.max(...prices);
    
    if (maxPrice >= 500) {
        console.log(`Purging ${item.university} (Cost was: ${item.cost})`);
        item.isChecked = false;
        
        // Ensure we don't wipe out the manually verified URL if it's already there, 
        // we just want to force a re-scrape of the page content!
        item.cost = 'TBA';
        item.dates = 'TBA';
        
        toProcess.push({
            university: item.university,
            missing: ['cost', 'dates']
        });
        count++;
    }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

const QUEUE_FILE = 'x:/NCAA-DivisonI-Baseball-Camps-2026/missing_data_queue.json';
fs.writeFileSync(QUEUE_FILE, JSON.stringify({
    title: 'Expensive Camps Audit Batch',
    created: new Date().toISOString(),
    batchSize: toProcess.length,
    queue: toProcess
}, null, 2));

console.log(`\nPurged & Queued ${count} >$500 schools. Ready to run smart_extract.js!`);
