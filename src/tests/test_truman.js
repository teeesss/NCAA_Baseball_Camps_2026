const puppeteer = require('puppeteer');
const fs = require('fs');
const { getMascot, buildSearchQuery, getUniversityAliases } = require('./mascot_lookup');

const log = (msg) => console.log(`[TEST] ${msg}`);

const extractDataFromText = (fullText) => {
    let campTiers = [];
    let lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    for (let j = 0; j < lines.length; j++) {
        let line = lines[j];
        if (/(?:jun|jul|aug|june|july|august)\w*\s+\d/i.test(line) || /\b0?[6-8]\/\d{1,2}/.test(line)) {
            let block = lines.slice(Math.max(0, j-3), Math.min(lines.length, j+6)).join(' | ');
            let low = block.toLowerCase();
            if (low.includes('2025') || low.includes('2024')) continue;
            let nameMatch = block.match(/([A-Z0-9][A-Za-z0-9\s\/&]+(?:Camp|Clinic|Prospect|Showcase|Elite|Year-Round|Program))/);
            let dateMatch = block.match(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2})|(?:\b0?[6-8]\/\d{1,2})/gi);
            let costMatch = block.match(/\$\d+/);
            if (dateMatch) {
                campTiers.push({
                    name: nameMatch ? nameMatch[1].trim() : "Upcoming Camp",
                    dates: dateMatch.slice(0, 3).join(', '),
                    cost: costMatch ? costMatch[0] : "TBA"
                });
            }
        }
    }
    return campTiers.filter((v, i, a) => a.findIndex(t => t.name === v.name && t.dates === v.dates) === i);
};

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const url = "https://www.trumanbaseballcamps.com/pitchingcatching-camp.cfm";
    log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        let text = await page.evaluate(() => document.body.innerText);
        log(`Extracted text length: ${text.length}`);
        
        let tiers = extractDataFromText(text);
        if (tiers.length > 0) {
            log(`🎯 SUCCESS FOUND TIERS: \n${JSON.stringify(tiers, null, 2)}`);
        } else {
            log(`❌ FAILED TO FIND TIERS.`);
            const matches = text.match(/(?:jun|jul|aug|june|july|august)\w*\s+\d/gi);
            log(`Found raw date matches: ${matches ? matches.join(', ') : 'None'}`);
        }
    } catch (e) {
        log(`ERROR: ${e.message}`);
    }
    await browser.close();
})();
