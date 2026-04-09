const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const data = require(DATA_FILE);

const badSchools = ["Clemson", "East Carolina", "Dayton", "Coastal Carolina", "BYU", "Davidson", "Brigham Young University", "Campbell", "Central Arkansas", "CSUN", "Central Michigan", "Charleston", "Coastal Carolina", "Bellarmine", "Brown", "Bryant"];

data.forEach(s => {
  if (badSchools.includes(s.university)) {
    console.log(`Resetting ${s.university}`);
    s.headCoach = "N/A";
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log("Cleanup done.");
