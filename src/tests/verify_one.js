const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getMascot } = require('./mascot_lookup');

// Mock a single school for verification
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
let target = data.find(d => d.university === "Bluefield State University") || data.find(d => d.university.includes("Bluefield State"));

if (!target) {
    console.log("School not found in camps_data.json");
    process.exit(1);
}

// Override to ensure it's processed
target.isChecked = false;
target.scriptVersion = 4; // Lower than 5 to trigger processing

// Save back temporarily
fs.writeFileSync('verify_target.json', JSON.stringify([target], null, 2));

async function run() {
    // We will use the actual extract_camp_details.js but modified to read verify_target.json instead of camps_data.json
    let script = fs.readFileSync('extract_camp_details.js', 'utf8');
    script = script.replace("'camps_data.json'", "'verify_target.json'");
    fs.writeFileSync('extract_verify.js', script);
    
    console.log(`Starting verification for: ${target.university}`);
    const { execSync } = require('child_process');
    try {
        execSync('node extract_verify.js', { stdio: 'inherit' });
    } catch (e) {
        console.error("Verification failed.");
    }
}

run();
