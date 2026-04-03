const fs = require('fs');
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
data = data.filter(d => d.university !== 'Academy of Art University');
fs.writeFileSync('camps_data.json', JSON.stringify(data, null, 2));
console.log('Removed Academy of Art University');
