const fs = require('fs');
const path = 'camps_data.json';
const schoolsToReset = [
    "Alcorn State",
    "Prairie View A&M",
    "Quinnipiac",
    "Radford",
    "Western Oregon University",
    "Ouachita Baptist",
    "Western Carolina"
];

let data = JSON.parse(fs.readFileSync(path, 'utf8'));
let count = 0;

data = data.map(item => {
    if (schoolsToReset.includes(item.university)) {
        item.isChecked = false;
        item.dates = "TBA";
        item.cost = "TBA";
        item.details = "";
        item.campTiers = [];
        count++;
    }
    return item;
});

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`Reset ${count} schools.`);
