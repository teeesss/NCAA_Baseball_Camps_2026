const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, '../../camps_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const highFidelityMap = {
  "Indiana": "https://www.jeffmercerbaseballcamps.com/",
  "Southern Indiana": "https://coachrambaseball.com/",
  "USC": "https://info.collegebaseballcamps.com/trojans/",
  "Washington": "http://collegebaseballcamps.com/uw/",
  "Florida State": "http://collegebaseballcamps.com/fsu/",
  "Clemson": "https://info.collegebaseballcamps.com/tigerbaseballcamp/",
  "TCU": "http://collegebaseballcamps.com/tcu/",
  "Rice": "https://info.collegebaseballcamps.com/jose-cruz-jr-baseball/",
  "Ole Miss": "http://collegebaseballcamps.com/olemiss/",
  "North Carolina": "http://collegebaseballcamps.com/unc/",
  "Duke": "http://collegebaseballcamps.com/duke/",
  "Houston": "http://collegebaseballcamps.com/uh/",
  "Arizona": "http://collegebaseballcamps.com/az/",
  "Georgia": "http://collegebaseballcamps.com/uga/",
  "Arizona State": "http://collegebaseballcamps.com/asu/",
  "San Diego State": "http://collegebaseballcamps.com/sdsu/",
  "Davidson": "http://collegebaseballcamps.com/davidson/",
  "New Mexico": "http://collegebaseballcamps.com/nm/"
};

// Check the other teams that might use this domain, the user mentioned they saw logos for them.
// "Auburn"

let count = 0;
data.forEach(item => {
  if (highFidelityMap[item.university]) {
    item.campUrl = highFidelityMap[item.university];
    item.sourceUrl = highFidelityMap[item.university];
    item.dates = "TBA";
    item.cost = "TBA";
    item.campTiers = [];
    item.isChecked = false;
    item.isVerified = false;
    item.scriptVersion = 15;
    count++;
  }
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`Updated ${count} schools in camps_data.json.`);
