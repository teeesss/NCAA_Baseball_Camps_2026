const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const total = data.length;
const checked = data.filter(s => s.isChecked).length;
const unchecked = total - checked;
const hasData = data.filter(s => s.campTiers && s.campTiers.length > 0).length;
const noDataButChecked = data.filter(s => s.isChecked && (!s.campTiers || s.campTiers.length === 0)).length;

console.log(`Total Schools: ${total}`);
console.log(`Checked: ${checked}`);
console.log(`Unchecked: ${unchecked}`);
console.log(`Schools with Tiers: ${hasData}`);
console.log(`Checked but No Tiers: ${noDataButChecked}`);

// List some "No Tiers" examples for inspection
const examples = data.filter(s => s.isChecked && (!s.campTiers || s.campTiers.length === 0)).slice(0, 10).map(s => s.university);
console.log('Examples of checked with no tiers:', examples);
