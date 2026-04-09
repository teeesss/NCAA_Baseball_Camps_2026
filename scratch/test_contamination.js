const { checkContamination } = require('../src/utils/extraction_engine');
const { getMascot, getUniversityAliases } = require('../src/utils/mascot_lookup');

const data = JSON.parse(require('fs').readFileSync('camps_data.json', 'utf8'));
const allSchoolNames = data.map(d => d.university);

const tierName = "Sun Devil Baseball Camp";
const targetUni = "Arizona";

const culprit = checkContamination(tierName, targetUni, allSchoolNames);
console.log(`Tier: "${tierName}" | Target: "${targetUni}" | Culprit: ${culprit || 'None'}`);

const textWithTarget = "Arizona Wildcats - Join our Sun Devil Baseball Camp";
const culprit2 = checkContamination(textWithTarget, targetUni, allSchoolNames);
console.log(`Text: "${textWithTarget}" | Target: "${targetUni}" | Culprit: ${culprit2 || 'None'}`);
