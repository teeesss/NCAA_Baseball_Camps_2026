const data = require('../camps_data.json');
const allPurged = data.filter(s => s.auditStatus === 'BAD_EMAIL_PURGED' || s.auditStatus === 'PARTIAL_RECOVERY_EMAIL_ONLY' || s.auditStatus === 'V11_SUCCESS');
const recovered = allPurged.filter(s => s.campPOCEmail && s.campPOCEmail !== '' && !s.campPOCEmail.includes('playnsports.com'));
const remaining = data.filter(s => !s.isChecked);

console.log(`--- Email Recovery Dashboard ---`);
console.log(`Successfully Recovered: ${recovered.length}`);
console.log(`Remaining in Queue: ${remaining.length}`);

if (recovered.length > 0) {
    console.log(`\nRecently Recovered Examples:`);
    recovered.slice(-5).forEach(s => {
        console.log(` - ${s.university}: ${s.campPOCEmail}`);
    });
}

if (remaining.length > 0) {
    console.log(`\nNext in Queue: ${remaining.slice(0, 5).map(s => s.university).join(', ')}...`);
}
