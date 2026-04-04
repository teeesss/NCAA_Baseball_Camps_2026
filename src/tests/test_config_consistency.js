const fs = require('fs');
const path = require('path');

// ── Strict Configurations to Enforce Single Source of Truth ──
const TARGET_CONSTANTS = [
    'REJECT_SPORTS',
    'DATE_PATTERNS',
    'COST_PATTERN',
    'EMAIL_PATTERN',
    'OFFICIAL_PLATFORMS',
    'BLACKLISTED_DOMAINS',
    'COST_RANGE',
    'GENERIC_EMAIL_PREFIXES',
    'SUBDOMAIN_BLACKLIST_PREFIXES'
];

// Folders to recursively scan
const TARGET_DIRS = [
    path.join(__dirname, '../../'),          // Project Root (for smart_extract.js etc)
    path.join(__dirname, '../utils'),        // src/utils
    path.join(__dirname, '../tests')         // src/tests
];

// Ignore these active central files (as they legitimately define or test variables in a unique way)
const IGNORE_FILES = [
    'config.js',
    'blacklist.json',
    'test_config_consistency.js', // This script
    'test_blacklist_consistency.js'
];

let errors = [];

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Ignore node_modules, .git, and archives
            if (!['node_modules', '.git', 'archives'].includes(file)) {
                scanDirectory(fullPath);
            }
        } else if (file.endsWith('.js') && !IGNORE_FILES.includes(file)) {
            checkFile(fullPath);
        }
    }
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // We only care if the script is trying to hardcode/define these arrays/regexes locally
        // E.g., `const REJECT_SPORTS = [...]` or `let COST_PATTERN = /.../`
        for (const target of TARGET_CONSTANTS) {
            // Pattern to catch local variable assignments of these globals
            const regex = new RegExp(`(?:const|let|var)\\s+${target}\\s*=`, 'i');
            
            if (regex.test(line)) {
                errors.push({
                    file: path.basename(filePath),
                    line: i + 1,
                    message: `Found local definition of ${target}. MUST import from config.js instead.`
                });
            }
        }
    }
}

console.log('\n🔍 PROJECT CONFIGURATION DRIFT AUDIT');
console.log('==============================================');

TARGET_DIRS.forEach(scanDirectory);

if (errors.length > 0) {
    console.log(`\n❌ FAILED: Found ${errors.length} instances of hardcoded configuration drift:\n`);
    errors.forEach(e => {
        console.log(`  ➤ ${e.file}:${e.line} — ${e.message}`);
    });
    console.log('\nAll active scripts MUST import these constants from src/utils/config.js');
    process.exit(1);
} else {
    console.log('\n✅ PASSED: No configuration drift detected.');
    console.log(`   (Verified ${TARGET_CONSTANTS.length} global config tokens across all active src files)`);
    process.exit(0);
}
