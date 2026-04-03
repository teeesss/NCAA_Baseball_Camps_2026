const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getMascot } = require('./mascot_lookup');

// Load master data
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const allSchoolNames = data.map(d => d.university);

const SCHOOL_TIMEOUT_MS = 60000;
const delay = ms => new Promise(res => setTimeout(res, ms));

const LOG_FILE = path.join(__dirname, 'extraction_all.log');
function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    console.log(formatted);
    try {
        fs.appendFileSync(LOG_FILE, formatted + '\n');
    } catch (e) {}
}

function getUniversityAliases(name) {
    let aliases = [name.toLowerCase()];
    let clean = name.replace(/University of | University| State University|College of | College/g, '').trim();
    if (clean !== name) aliases.push(clean.toLowerCase());
    const m = getMascot(name);
    if (m) aliases.push(m.toLowerCase());
    return [...new Set(aliases)];
}

function getCoachSearch(camp) {
    if (camp.contact.includes('TBA')) return '';
    let raw = camp.contact.split('|')[0].replace(/\(.*?\)/g, '').trim();
    if (raw.includes('@') || raw.length < 3) return ''; 
    return raw;
}

function scoreUrl(url, school, isGuessed = false) {
    if (!url) return -100;
    let score = 0;
    let u = url.toLowerCase();
    let s = (school.university || '').toLowerCase();
    let coach = getCoachSearch(school).toLowerCase();
    
    if (u.includes('baseball')) score += 40;
    if (u.includes('camp') || u.includes('clinic')) score += 20;
    if (u.includes('ryzer.com') || u.includes('totalcamps.com')) score += 50;
    if (coach && coach.length > 2 && u.includes(coach.split(' ')[0])) score += 35;
    if (u.includes(s.replace(/\s+/g, ''))) score += 25;
    if (isGuessed) score -= 40;
    return score;
}

const run = async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const camp = data.find(d => d.university.includes('Felician'));
    
    if (!camp) { console.log("Felician not found"); process.exit(0); }

    log(`\n════════════════════════════════════════════════════════════`);
    log(`[TEST] Processing: ${camp.university}`);
    log(`════════════════════════════════════════════════════════════`);

    const p = await browser.newPage();
    await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    try {
        let searchLinks = [];
        const queries = [`${camp.university} baseball camp 2026`];
        const coach = getCoachSearch(camp);
        if (coach) queries.push(`${coach} baseball camp 2026`);

        for (let q of queries) {
            log(`      ↳ Searching Bing for: ${q}`);
            await p.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            let bingLinks = await p.evaluate(() => Array.from(document.querySelectorAll('#b_results .b_algo h2 a')).map(a => a.href));
            if (bingLinks) searchLinks = [...searchLinks, ...bingLinks];

            log(`      ↳ Searching Brave Search for: ${q}`);
            await p.goto(`https://search.brave.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            let braveLinks = await p.evaluate(() => Array.from(document.querySelectorAll('a.result-header')).map(a => a.href));
            if (braveLinks) searchLinks = [...searchLinks, ...braveLinks];
        }

        let scored = searchLinks.map(u => ({ url: u, score: scoreUrl(u, camp, false) }))
            .sort((a, b) => b.score - a.score)
            .filter((x, i, a) => a.findIndex(y => y.url === x.url) === i)
            .slice(0, 10);

        log(`   -> Candidates: ${scored.length}`);
        scored.forEach(s => log(`      [${s.score}] ${s.url}`));

    } catch (err) { log(`   -> ERROR: ${err.message}`); }
    finally { await browser.close(); }
}

run();
