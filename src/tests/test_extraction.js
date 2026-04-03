const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getMascot } = require('./mascot_lookup');

// Load master data
let data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const allSchoolNames = data.map(d => d.university);

// Configurations
const delay = ms => new Promise(res => setTimeout(res, ms));

const LOG_FILE = path.join(__dirname, 'test_extraction.log');
function log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    console.log(formatted);
    try {
        fs.appendFileSync(LOG_FILE, formatted + '\n');
    } catch (e) {}
}

// ─── Utility: Helpers ──────────────────────────────────────────
function getUniversityAliases(name) {
    let aliases = [name.toLowerCase()];
    let clean = name.replace(/University of | University| State University|College of | College/g, '').trim();
    if (clean !== name) aliases.push(clean.toLowerCase());
    if (name.includes('Louisiana State')) aliases.push('lsu');
    if (name.includes('Mississippi')) aliases.push('ole miss');
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

function checkContamination(title, text, targetUni) {
    const titleLower = title.toLowerCase();
    const targetLower = targetUni.toLowerCase();
    for (let other of allSchoolNames) {
        if (other === targetUni) continue;
        const otherLower = other.toLowerCase();
        
        let escapedOther = otherLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(`\\b${escapedOther}\\b`, 'i');
        
        if (regex.test(titleLower) && !targetLower.includes(otherLower)) {
            return other;
        }
    }
    return null;
}

function scoreUrl(url, school, isGuessed = false) {
    if (!url) return -100;
    let score = 0;
    let u = url.toLowerCase();
    let s = (school.university || '').toLowerCase();
    let coach = getCoachSearch(school).toLowerCase();
    let mascot = (school.mascot || '').toLowerCase();
    
    if (u.includes('baseball')) score += 40;
    if (u.includes('camp') || u.includes('clinic')) score += 20;
    if (u.includes('/sports/baseball')) score += 15;
    if (coach && coach.length > 2 && u.includes(coach.split(' ')[0])) score += 35; // Match last name
    if (mascot && u.includes(mascot)) score += 20;
    if (u.includes(s.replace(/\s+/g, ''))) score += 25;
    
    if (u.includes('ryzer.com') || u.includes('totalcamps.com') || u.includes('active.com')) score += 50;
    if (u.endsWith('.edu')) score += 10;
    if (isGuessed) score -= 40; // Penalty for speculative guessing

    const bad = ['wikipedia', 'espn', 'facebook', 'twitter', 'instagram', 'fandom', 'warrennolan', 'newsbreak', 'ussportscamps'];
    if (bad.some(b => u.includes(b))) score -= 100;
    
    return score;
}

function extractDataFromText(fullText) {
    let campTiers = [];
    let lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    for (let j = 0; j < lines.length; j++) {
        let line = lines[j];
        if (/(?:jun|jul|aug|june|july|august)\w*\s+\d/i.test(line) || /\b0?[6-8]\/\d{1,2}/.test(line)) {
            let block = lines.slice(Math.max(0, j-3), Math.min(lines.length, j+6)).join(' | ');
            let low = block.toLowerCase();
            if (low.includes('2025') || low.includes('2024')) continue;
            if (low.includes('review') || low.includes('recommend') || low.includes('amazing') || low.includes('nike')) continue;
            if (low.includes('basketball') || low.includes('soccer') || low.includes('softball')) continue;

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
}

const run = async () => {
    fs.writeFileSync(LOG_FILE, '');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
    const toProcess = data.filter(d => d.university === 'Alabama');

    log(`[TEST MODE] Target: Alabama. Logic: V5 Ultra-Fidelity (No DDG).`);

    for (let i = 0; i < toProcess.length; i++) {
        let camp = toProcess[i];
        log(`\nProcessing: ${camp.university}`);
        const p = await browser.newPage();
        await p.setViewport({ width: 1280, height: 800 });
        await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        try {
            let searchLinks = [];
            const queries = [`${camp.university} baseball camp 2026`];
            const coach = getCoachSearch(camp);
            if (coach) queries.push(`${coach} baseball camp 2026`);

            const providers = [
                {
                    name: "Bing",
                    search: async (q) => {
                        await p.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        return await p.evaluate(() => Array.from(document.querySelectorAll('#b_results .b_algo h2 a, h2 a')).map(a => a.href));
                    }
                },
                {
                    name: "Yahoo",
                    search: async (q) => {
                        await p.goto(`https://search.yahoo.com/search?p=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        return await p.evaluate(() => Array.from(document.querySelectorAll('.title a, .compTitle a, #web h3 a, .algo a')).map(a => a.href));
                    }
                },
                {
                    name: "Brave",
                    search: async (q) => {
                        await p.goto(`https://search.brave.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        return await p.evaluate(() => Array.from(document.querySelectorAll('a.result-header, h3 a, #results a')).map(a => a.href));
                    }
                },
                {
                    name: "Ask",
                    search: async (q) => {
                        await p.goto(`https://www.ask.com/web?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                        return await p.evaluate(() => Array.from(document.querySelectorAll('.PartialSearchResults-item-title-link, a.result-link, h3 a, .compTitle a')).map(a => a.href));
                    }
                }
            ];

            for (let q of queries) {
                // Alternately start with Bing or Yahoo (the two that work 100%)
                let startPos = i % 2; 
                
                for (let step = 0; step < providers.length; step++) {
                    const provider = providers[(startPos + step) % providers.length];
                    if (searchLinks.length >= 6) break;

                    try {
                        log(`      ↳ [${provider.name}] searching: ${q}`);
                        let links = await provider.search(q);
                        if (links && links.length > 0) {
                            searchLinks = [...searchLinks, ...links];
                        }
                    } catch(e) {
                        log(`      ✕ ${provider.name} error: ${e.message.substring(0, 30)}`);
                    }
                    await delay(1200);
                }
                await delay(2000);
            }

            searchLinks = [...new Set(searchLinks)].filter(l => l && l.startsWith('http') && !l.includes('google.com') && !l.includes('bing.com/search') && !l.includes('search.yahoo'));
            
            let guessed = [];
            let cleanUni = camp.university.replace(/The /gi, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            guessed.push(`https://www.${cleanUni}baseballcamps.com`);

            let scored = [
                ...searchLinks.map(u => ({ url: u, score: scoreUrl(u, camp, false) })),
                ...guessed.map(u => ({ url: u, score: scoreUrl(u, camp, true) }))
            ].sort((a, b) => b.score - a.score).slice(0, 10);

            log(`   -> Candidate URLs: ${scored.length}`);
            scored.forEach(s => log(`      [${s.score}] ${s.url}`));

            for (let item of scored) {
                try {
                    log(`\n   -> Trying: ${item.url}`);
                    const resp = await p.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    if (!resp || resp.status() >= 400) continue;
                    await delay(1000);
                    let title = await p.title();
                    let text = await p.evaluate(() => document.body.innerText);
                    
                    const aliases = getUniversityAliases(camp.university);
                    if (!aliases.some(a => text.toLowerCase().includes(a) || title.toLowerCase().includes(a))) {
                        log(`      ✕ Name check fail.`); continue;
                    }

                    const contam = checkContamination(title, text, camp.university);
                    if (contam) {
                        log(`      ✕ Contamination: Match found for school "${contam}" in title "${title}"`);
                        continue;
                    }

                    log(`   -> ✅ Validated. Extracting...`);
                    let fullText = text;

                    // ANTI-BLOAT SUB-CRAWL
                    let subLinks = await p.$$eval('a', els => els.map(a => ({ href: a.href, text: (a.innerText || "").toLowerCase() })));
                    const excludePatterns = ['/roster', '/schedule', '/news', '/article', '/player', '/staff', '/shop', '/ticket', '/game', '/scores'];
                    let filteredSub = subLinks.filter(l => {
                        if (!l.href || !l.href.startsWith('http')) return false;
                        let hl = l.href.toLowerCase();
                        if (hl.includes('facebook') || hl.includes('twitter') || hl.includes('google.com')) return false;
                        if (excludePatterns.some(e => hl.includes(e)) && !hl.includes('camp') && !l.text.includes('camp')) return false;
                        return ['camp', 'clinic', 'prospect', 'register', 'tier', 'detail'].some(k => hl.includes(k) || l.text.includes(k));
                    }).slice(0, 8);

                    log(`   -> Crawling ${filteredSub.length} sub-links...`);
                    for (let sl of filteredSub) {
                        try {
                            const sp = await browser.newPage();
                            await sp.goto(sl.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
                            let st = await sp.evaluate(() => document.body.innerText);
                            if (st && st.toLowerCase().includes('baseball')) {
                                log(`      ⭐ ${sl.href.substring(0, 55)}... [✓]`);
                                fullText += '\n' + st;
                            }
                            await sp.close();
                        } catch(e) {}
                    }
                    let campTiers = extractDataFromText(fullText);
                    if (campTiers.length > 0) {
                        camp.campTiers = campTiers;
                        camp.dates = [...new Set(campTiers.map(t => t.dates))].join(' | ') + " 2026";
                        camp.campUrl = item.url;
                        camp.confidenceScore = 100;
                        
                        log(`   -> 🎯 SUCCESS! Extracted data payload:`);
                        log(`      [Contact]: ${camp.contact}`);
                        log(`      [Final Dates]: ${camp.dates}`);
                        log(`      [URL]: ${camp.campUrl}`);
                        if(camp.details) log(`      [Details]: ${camp.details.substring(0, 80)}...`);
                        
                        log(`\n      [Extracted Tiers]:`);
                        campTiers.forEach(t => log(`        ✓ ${t.name} | Dates: ${t.dates} | Cost: ${t.cost}`));
                        break;
                    } else {
                        log(`      ✕ No 2026 data found on main page.`);
                    }
                } catch(e) { log(`      ✕ Error: ${e.message}`); }
            }

        } catch(e) { log(`   -> Major error: ${e.message}`); }
        finally { await p.close(); }
    }
    await browser.close();
    log(`\nTest Done.`);
}
run();
