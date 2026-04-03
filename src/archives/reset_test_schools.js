const fs = require('fs');
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const targets = ['Arkansas', 'Alabama', 'Central Arkansas', 'Army', 'Baylor'];
for (let t of targets) {
    let c = data.find(d => d.university === t);
    if (c) {
        c.dates = 'TBA';
        c.cost = 'TBA';
        c.isChecked = false;
        c.isVerified = false;
        c.scriptVersion = 1;
        console.log('Reset: ' + c.university + ' -> campUrl: ' + c.campUrl);
    }
}
fs.writeFileSync('camps_data.json', JSON.stringify(data, null, 2));
console.log('Done. All 5 schools reset.');
