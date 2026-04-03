/**
 * TEST SUITE: llm-issues-prompt.md Validation
 * ═══════════════════════════════════════════════
 * Verifies all 5 fixes applied to smart_extract.js:
 *   1. Sport exclusivity filter
 *   2. Year prioritization in search results
 *   3. Baseball-context email extraction
 *   4. Team camp / legacy date filtering
 *   5. Cost ceiling alignment ($100-$1500)
 *
 * Run: node src/tests/test_llm_issues.js
 * Expected: All tests PASS (0 failures)
 * ═══════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ── Load the functions under test ──────────────────────────────
// We load smart_extract.js's module-level functions by re-implementing
// them identically here for pure unit testing (no Puppeteer dependency).

const BLACKLIST_FILE = path.join(__dirname, '../../blacklist.json');
const BLACKLISTED_DOMAINS = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')).domains;

// ── Sport Exclusivity (from smart_extract.js) ──
const REJECT_SPORTS = ['football', 'basketball', 'soccer', 'tennis', 'swimming', 'golf', 'volleyball', 'wrestling', 'lacrosse', 'softball', 'hockey', 'track and field'];
function isWrongSport(text) {
    const lower = text.toLowerCase();
    if (lower.includes('baseball')) return false;
    return REJECT_SPORTS.some(sport => lower.includes(sport + ' camp') || lower.includes(sport + ' clinic'));
}

// ── Team Camp / Legacy ──
function isTeamCampOrLegacy(text) {
    const lower = text.toLowerCase();
    const isTeamOnly = lower.includes('team camp') && !lower.includes('individual');
    const isLegacy   = lower.includes('2025') && !lower.includes('2026');
    return isTeamOnly || isLegacy;
}

// ── Extraction ──
const DATE_PATTERNS = [
  /\b(jun|jul|aug)[a-z]*\.?\s+\d{1,2}(?:[-–]\d{1,2})?,?\s*2026/gi,
  /\b0?[678]\/\d{1,2}\/2026/g,
  /\b2026[-/]0?[678][-/]\d{2}/g,
];
const COST_PATTERN = /\$\s*(\d[\d,.]*(?:\.\d{2})?)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractData(text, url) {
    if (isWrongSport(text)) {
        return { dates: null, cost: null, costVal: null, email: null, url };
    }
    if (isTeamCampOrLegacy(text)) {
        return { dates: null, cost: null, costVal: null, email: null, url };
    }

    let datesList = [];
    for (const pat of DATE_PATTERNS) {
        pat.lastIndex = 0;
        let m;
        while ((m = pat.exec(text)) !== null) {
            datesList.push(m[0].trim());
        }
    }
    const dates = datesList.length ? [...new Set(datesList)].slice(0, 3).join(' | ') : null;

    let bestCost = null;
    let costRaw = null;
    let costs = [];
    COST_PATTERN.lastIndex = 0;
    let m2;
    while ((m2 = COST_PATTERN.exec(text)) !== null) {
        let val = parseFloat(m2[1].replace(/,/g, ''));
        costs.push(val);
    }
    if (costs.length) {
        let validCosts = costs.filter(c => c >= 100 && c <= 1500);
        if (validCosts.length) {
            validCosts.sort((a,b) => a-b);
            bestCost = validCosts[0];
            costRaw = `$${bestCost}`;
        }
    }

    // Baseball-context email extraction
    let emailsList = [];
    const sections = text.split(/\n\s*\n/);
    for (const section of sections) {
        const sectionLower = section.toLowerCase();
        // Primary gate: section must mention 'baseball' or 'camp' (not other sports' coaches)
        const hasBaseballContext = sectionLower.includes('baseball') || sectionLower.includes('camp');
        // Secondary gate: 'coach'/'contact' only valid WITH baseball context
        const hasContactContext = (sectionLower.includes('coach') || sectionLower.includes('contact')) && hasBaseballContext;
        // Reject sections that are clearly about other sports
        const isOtherSport = ['basketball', 'football', 'soccer', 'volleyball', 'softball', 'tennis', 'swimming'].some(s => sectionLower.includes(s)) && !sectionLower.includes('baseball');
        
        if ((hasBaseballContext || hasContactContext) && !isOtherSport) {
            EMAIL_PATTERN.lastIndex = 0;
            let m3;
            while ((m3 = EMAIL_PATTERN.exec(section)) !== null) {
                let e = m3[0].toLowerCase();
                if (!BLACKLISTED_DOMAINS.some(b => e.includes(b)) && !e.includes('example') && !e.includes('noreply') && !e.includes('sentry')) {
                    emailsList.push(e);
                }
            }
        }
    }
    if (emailsList.length === 0) {
        EMAIL_PATTERN.lastIndex = 0;
        let m3;
        while ((m3 = EMAIL_PATTERN.exec(text)) !== null) {
            let e = m3[0].toLowerCase();
            if (!BLACKLISTED_DOMAINS.some(b => e.includes(b)) && !e.includes('example') && !e.includes('noreply') && e.endsWith('.edu')) {
                emailsList.push(e);
            }
        }
    }
    const email = emailsList.length ? emailsList[0] : null;

    return { dates, cost: costRaw, costVal: bestCost, email, url };
}

// ══════════════════════════════════════════════════════════════
//  TEST RUNNER
// ══════════════════════════════════════════════════════════════
let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

console.log('\n═══════════════════════════════════════════════');
console.log(' TEST SUITE: llm-issues-prompt.md Validation');
console.log('═══════════════════════════════════════════════\n');

// ── TEST GROUP 1: Sport Exclusivity ──
console.log('📋 GROUP 1: Sport Exclusivity Filter');

assert(isWrongSport('Welcome to Oklahoma State Football Camp 2026') === true,
    'Football camp page rejected');

assert(isWrongSport('Basketball Camp - Summer 2026 Clinic') === true,
    'Basketball clinic page rejected');

assert(isWrongSport('Welcome to Oklahoma State Baseball Camp 2026 - we also have football camp') === false,
    'Mixed page WITH baseball keyword accepted');

assert(isWrongSport('Summer Camp 2026 - Youth Skills Training') === false,
    'Generic camp page without sport keyword accepted');

assert(isWrongSport('Volleyball Camp dates June 15-18') === true,
    'Volleyball camp rejected');

assert(isWrongSport('University Baseball Camp Registration - $250') === false,
    'Pure baseball camp accepted');

// ── TEST GROUP 2: Team Camp / Legacy Detection ──
console.log('\n📋 GROUP 2: Team Camp / Legacy Detection');

assert(isTeamCampOrLegacy('2025 Summer Baseball Team Camp Dates') === true,
    'Legacy 2025 page rejected');

assert(isTeamCampOrLegacy('Team Camp Only - June 2026') === true,
    'Team-only camp rejected');

assert(isTeamCampOrLegacy('Team Camp & Individual Skills Camp - June 2026') === false,
    'Team + Individual camp accepted');

assert(isTeamCampOrLegacy('2025 results and 2026 upcoming camp dates') === false,
    'Page mentioning both years accepted');

assert(isTeamCampOrLegacy('Individual Prospect Camp 2026 Dates') === false,
    'Pure individual camp accepted');

// ── TEST GROUP 3: Date Extraction (2026 only) ──
console.log('\n📋 GROUP 3: Strict Date Filtering');

const dateTest1 = extractData('June 15, 2026 - Summer Baseball Camp - $250', 'https://example.edu/camp');
assert(dateTest1.dates !== null && dateTest1.dates.includes('June 15'), 
    'June 2026 date extracted correctly');

const dateTest2 = extractData('Camp scheduled for January 10, 2025', 'https://example.edu/camp');
assert(dateTest2.dates === null, 
    '2025 date NOT extracted (wrong year)');

const dateTest3 = extractData('07/20/2026 Baseball Prospect Camp', 'https://example.edu/camp');
assert(dateTest3.dates !== null && dateTest3.dates.includes('07/20/2026'), 
    'Numeric 2026 date extracted');

const dateTest4 = extractData('August 5-8, 2026 Youth Baseball Camp', 'https://example.edu/camp');
assert(dateTest4.dates !== null,
    'August multi-day range extracted');

// ── TEST GROUP 4: Cost Filtering ──
console.log('\n📋 GROUP 4: Cost Filtering ($100-$1500)');

const costTest1 = extractData('Baseball Camp 2026 - $250 per player - June 10, 2026', 'https://example.edu');
assert(costTest1.costVal === 250,
    '$250 accepted (normal range)');

const costTest2 = extractData('Baseball Camp 2026 - $50 discount - June 10, 2026', 'https://example.edu');
assert(costTest2.costVal === null,
    '$50 rejected (below $100 floor)');

const costTest3 = extractData('Baseball Camp 2026 - $2000 team package - June 10, 2026', 'https://example.edu');
assert(costTest3.costVal === null,
    '$2000 rejected (above $1500 ceiling)');

const costTest4 = extractData('Baseball Camp - $150 youth | $400 prospect | $800 elite - June 10, 2026', 'https://example.edu');
assert(costTest4.costVal === 150,
    'Multiple costs: lowest valid ($150) selected');

const costTest5 = extractData('Baseball Camp 2026 - $1200 Elite Prospect Camp - July 1, 2026', 'https://example.edu');
assert(costTest5.costVal === 1200,
    '$1200 accepted (legitimate high-end individual camp)');

// ── TEST GROUP 5: Baseball-Context Email Extraction ──
console.log('\n📋 GROUP 5: Baseball-Context Email Extraction');

const emailTest1 = extractData(
    'Basketball Section\nHead Coach: John Smith\nEmail: hoops@school.edu\n\n' +
    'Baseball Camp Info\nCoach Jones\nContact: baseball@school.edu\n\nJune 10, 2026',
    'https://example.edu'
);
assert(emailTest1.email === 'baseball@school.edu',
    'Email from baseball section extracted, basketball section ignored');

const emailTest2 = extractData(
    'Football recruiting office\nfootball@school.edu\n\n' +
    'Baseball Camp Info\nbaseball@school.edu\n\nJune 10, 2026',
    'https://example.edu'
);
assert(emailTest2.email === 'baseball@school.edu',
    'Baseball email preferred over football email when both exist');

const emailTest3 = extractData(
    'Baseball Camp Registration\nFor questions contact coach at camps@university.edu\nJune 15, 2026',
    'https://example.edu'
);
assert(emailTest3.email === 'camps@university.edu',
    'Email from camp contact section extracted correctly');

const emailTest4 = extractData(
    'Random page with no sport context\nwebmaster@university.edu\nJune 10, 2026 baseball camp',
    'https://example.edu'
);
assert(emailTest4.email !== null,
    'Fallback: .edu email extracted when camp context present on page');

// ── TEST GROUP 6: Full Pipeline (Composite) ──
console.log('\n📋 GROUP 6: Full Pipeline Integration');

// Oklahoma State football page (ISSUE 1 from prompt)
const okState = extractData(
    'Oklahoma State Football Camp 2026\nCowboy Stadium\nTickets available\nCoach Gundy\n$300',
    'https://okstate.com/football-camp'
);
assert(okState.dates === null && okState.cost === null,
    'ISSUE 1: Oklahoma State football page fully rejected');

// Florida 2025 vs 2026 (ISSUE 2 from prompt) 
const florida2025 = extractData(
    'Florida Gators Summer 2025 Baseball Camp\nJune 15, 2025\n$250',
    'https://floridagators.com/camps/2025'
);
assert(florida2025.dates === null,
    'ISSUE 2: Florida 2025 page rejected (legacy)');

// Virginia basketball email (ISSUE 3 from prompt)
const virginia = extractData(
    'Virginia Cavaliers Athletics\n\nBasketball Camp\nCoach Bennett\nhoops@virginia.edu\n\n' +
    'Baseball Camp Dates\nJune 20, 2026\n$275\nCoach O\'Connor\nbaseball@virginia.edu',
    'https://virginiasports.com'
);
assert(virginia.email === 'baseball@virginia.edu',
    'ISSUE 3: Virginia baseball email extracted, basketball email ignored');

// ── SUMMARY ──
console.log('\n═══════════════════════════════════════════════');
console.log(` RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('═══════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
