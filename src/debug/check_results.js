const fs = require('fs');

const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

const targets = [
  'Ball State', 'NJIT', 'Texas Southern', 'Seton Hill', 
  'Slippery Rock', 'Southern New Hampshire',
  'Southeastern Oklahoma State', 'Southern Arkansas', 'St. Cloud State'
];

const results = data.filter(d => targets.some(t => d.university.includes(t))).map(d => ({
  university: d.university,
  cost: d.cost,
  auditStatus: d.auditStatus,
  tierCount: d.campTiers ? d.campTiers.length : 0,
  recentLogs: d.updateLog ? d.updateLog.slice(-2) : []
}));

console.log(JSON.stringify(results, null, 2));
