const fs = require('fs');
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
['Arizona State', 'Florida State', 'Alabama', 'Alcorn State', 'Pittsburgh', 'Prairie View A&M', 'Radford'].forEach(u => {
    const school = data.find(c => c.university === u);
    console.log(`${u}: ${school ? (school.campTiers ? school.campTiers.length : 'MISSING TEIRS ARRAY') : 'NOT FOUND'} tiers`);
});
