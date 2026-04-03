const fs = require('fs');
const data = JSON.parse(fs.readFileSync('x:/NCAA-DivisonI-Baseball-Camps-2026/camps_data.json', 'utf8'));
const schools = ['Indiana', 'Southern Indiana', 'USC', 'Washington', 'Florida State', 'Clemson', 'TCU', 'Rice', 'Ole Miss', 'North Carolina', 'Duke', 'Houston', 'Arizona', 'Georgia', 'Arizona State', 'San Diego State', 'Davidson', 'New Mexico'];

const updated = data.filter(u => schools.includes(u.university));
updated.forEach(u => console.log(`${u.university}: Dates: ${u.dates === 'TBA' ? 'TBA' : 'FOUND'} | Cost: ${u.cost} | URL: ${u.campUrl}`));
