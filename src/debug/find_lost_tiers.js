const fs = require('fs');
const path = require('path');

const dataPath = path.join('z:', 'NCAA-DivisonI-Baseball-Camps-2026', 'camps_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const lostTiers = data.filter(item => 
    item.campTiers && 
    item.campTiers.length === 0 && 
    (item.campDates || (item.cost && item.cost !== 'TBA')) &&
    item.campDates !== 'TBA'
);

console.log(`Found ${lostTiers.length} schools with lost tiers:`);
console.log(lostTiers.map(t => t.university).join(', '));

const outputPath = path.join('z:', 'NCAA-DivisonI-Baseball-Camps-2026', 'lost_tiers_queue.json');
fs.writeFileSync(outputPath, JSON.stringify(lostTiers.map(t => t.university), null, 2));
