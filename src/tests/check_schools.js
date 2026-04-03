const fs = require('fs');
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
let targets = ['Arkansas', 'Alabama', 'Central Arkansas', 'Army', 'Baylor'];
for (let t of targets) {
    let c = data.find(d => d.university === t);
    if (c) {
        console.log('\n--- ' + c.university + ' ---');
        console.log('  campUrl: ' + c.campUrl);
        console.log('  dates: ' + c.dates);
        console.log('  cost: ' + c.cost);
        console.log('  contact: ' + c.contact);
        console.log('  division: ' + c.division);
        console.log('  isVerified: ' + c.isVerified);
        console.log('  isChecked: ' + c.isChecked);
        console.log('  logoDomain: ' + c.logoDomain);
    } else {
        console.log('\n--- ' + t + ': NOT FOUND ---');
        let fuzzy = data.filter(d => d.university.toLowerCase().includes(t.toLowerCase()));
        fuzzy.forEach(f => console.log('  Fuzzy match: ' + f.university));
    }
}
