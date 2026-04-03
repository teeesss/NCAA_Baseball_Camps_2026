const puppeteer = require('puppeteer');
const fs = require('fs');
const { getMascot } = require('./mascot_lookup');

// Mock data for test
let data = [{ university: 'Bluefield State University', contact: '(TBA)' }];
const allSchoolNames = data.map(d => d.university);

const delay = ms => new Promise(res => setTimeout(res, ms));

function getUniversityAliases(name) {
    let aliases = [name.toLowerCase()];
    let clean = name.replace(/University of | University| State University|College of | College/g, '').trim();
    if (clean !== name) aliases.push(clean.toLowerCase());
    const m = getMascot(name);
    if (m) aliases.push(m.toLowerCase());
    return [...new Set(aliases)];
}

function getCoachSearch(camp) {
    if (!camp.contact || camp.contact.includes('TBA')) return '';
    let raw = camp.contact.split('|')[0].trim();
    if (raw.includes('@') || raw.includes('(') || raw.length < 3) return ''; 
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
    if (u.includes(s.replace(/\s+/g, ''))) score += 25;
    if (isGuessed) score -= 40; 
    
    return score;
}

async function test() {
    const browser = await puppeteer.launch({ headless: "new" });
    const p = await browser.newPage();
    const camp = data[0];
    
    console.log(`Testing: ${camp.university}`);
    const queries = [`${camp.university} baseball camp 2026`];
    const coach = getCoachSearch(camp);
    if (coach) queries.push(`${coach} baseball camp 2026`);
    
    console.log(`Queries: ${queries.join(' | ')}`);
    
    let searchLinks = [];
    for (let q of queries) {
        console.log(`Searching DDG for: ${q}`);
        await p.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
        let ddgLinks = await p.evaluate(() => Array.from(document.querySelectorAll('.result__a')).map(a => a.href));
        
        if (ddgLinks && ddgLinks.length > 3) {
            console.log(`   -> DDG success: ${ddgLinks.length} links`);
            searchLinks = [...searchLinks, ...ddgLinks];
        } else {
            console.log(`   -> DDG sparse. Trying Bing...`);
            await p.goto(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
            let bingLinks = await p.evaluate(() => Array.from(document.querySelectorAll('#b_results .b_algo h2 a')).map(a => a.href));
            if (bingLinks && bingLinks.length > 0) {
                console.log(`   -> Bing success: ${bingLinks.length} links`);
                searchLinks = [...searchLinks, ...bingLinks];
            } else {
                console.log(`   -> Bing sparse. Trying Ask...`);
                await p.goto(`https://www.ask.com/web?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });
                let askLinks = await p.evaluate(() => Array.from(document.querySelectorAll('.PartialSearchResults-item-title-link')).map(a => a.href));
                console.log(`   -> Ask success: ${askLinks.length} links`);
                searchLinks = [...searchLinks, ...askLinks];
            }
        }
        await delay(1000);
    }
    
    let cleanUni = camp.university.replace(/The /gi, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let guessed = [];
    if (cleanUni.length < 25) {
        guessed.push(`https://www.${cleanUni}baseballcamps.com`);
        guessed.push(`https://www.${cleanUni}baseballevents.com`);
    }
    
    let scored = [
        ...searchLinks.map(u => ({ url: u, score: scoreUrl(u, camp, false), isGuessed: false })),
        ...guessed.map(u => ({ url: u, score: scoreUrl(u, camp, true), isGuessed: true }))
    ].sort((a, b) => b.score - a.score).slice(0, 5);
    
    console.log("Top Candidates:");
    scored.forEach(s => console.log(`[${s.score}] ${s.isGuessed ? '(GUESSED)' : '(SEARCH)'} ${s.url}`));
    
    await browser.close();
}

test();
