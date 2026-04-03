const fs = require('fs');
const path = require('path');

const DATA_PATH = 'camps_data.json';
const WHITELIST_SCHOOLS = ['Arkansas', 'Alabama'];

if (!fs.existsSync(DATA_PATH)) {
    console.error(`FATAL: ${DATA_PATH} not found.`);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

console.log(`🔎 Auditing ${data.length} schools...`);

const urlMap = new Map();
const duplicates = [];
const suspiciousPrices = [];
let resetsCount = 0;

const sanitized = data.map(school => {
    // Schema Normalization
    const name = school.university || school.u || "Unknown School";
    const url = school.campUrl || school.url || "";
    
    // 1. Verification Reset logic (STRICT EXACT MATCH ONLY)
    const isWhitelisted = WHITELIST_SCHOOLS.includes(name);
    
    if (!isWhitelisted && (school.isVerified || school.isHumanVerified)) {
        school.isVerified = false;
        school.isHumanVerified = false;
        school.verificationStatus = "Automated Scan";
        resetsCount++;
    }

    // 2. Duplicate URL detection (Red Flag)
    if (url && url.length > 10) {
        if (urlMap.has(url)) {
            duplicates.push({ url, s1: urlMap.get(url), s2: name });
        } else {
            urlMap.set(url, name);
        }
    }

    // 3. Price Anomaly detection (<$100)
    if (school.cost && typeof school.cost === 'string') {
        const costMatch = school.cost.match(/\$?(\d+)/);
        if (costMatch) {
            const price = parseInt(costMatch[1]);
            if (price > 0 && price < 100) {
                suspiciousPrices.push({ school: name, cost: school.cost, price });
            }
        }
    }

    return school;
});

// Reporting
console.log(`\n✅ RESET ${resetsCount} manual verifications.`);
console.log(`⭐ Preserved: ${WHITELIST_SCHOOLS.join(', ')}`);

if (duplicates.length > 0) {
    console.log(`\n🚩 RED FLAG: Found ${duplicates.length} duplicate URLs:`);
    duplicates.forEach(d => console.warn(`   - [${d.url}] shared by: "${d.s1}" and "${d.s2}"`));
} else {
    console.log('\n✅ NO duplicate URLs found.');
}

if (suspiciousPrices.length > 0) {
    console.log(`\n⚠️  SUSPICIOUS PRICING: Found ${suspiciousPrices.length} camps < $100:`);
    suspiciousPrices.forEach(p => console.warn(`   - "${p.school}": ${p.cost}`));
} else {
    console.log('\n✅ NO suspicious low-pricing found.');
}

// Save
fs.writeFileSync(DATA_PATH, JSON.stringify(sanitized, null, 2));
console.log(`\n💾 Saved updated ${DATA_PATH}.`);
