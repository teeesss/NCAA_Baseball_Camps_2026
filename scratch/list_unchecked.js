const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const unchecked = data.filter(s => !s.isChecked).map(s => s.university);
console.log(JSON.stringify(unchecked, null, 2));
console.log('Total:', unchecked.length);
