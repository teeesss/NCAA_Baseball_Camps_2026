const fs = require('fs');
const { execSync } = require('child_process');
const DATA_FILE = './camps_data.json';
const QUEUE_FILE = './missing_data_queue.json';

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node run_batch.js --teams="School A,School B" OR --conference="SEC"');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let targetSchools = [];

const teamsArg = args.find(a => a.startsWith('--teams='));
const confArg = args.find(a => a.startsWith('--conference='));

if (teamsArg) {
    const teams = teamsArg.split('=')[1].split(',').map(t => t.trim().toLowerCase());
    targetSchools = data.filter(r => teams.some(t => r.university.toLowerCase().includes(t)));
} else if (confArg) {
    const conf = confArg.split('=')[1].trim().toLowerCase();
    targetSchools = data.filter(r => r.conference && r.conference.toLowerCase() === conf);
}

console.log(`🎯 Found ${targetSchools.length} schools matching criteria.`);

if (targetSchools.length === 0) {
    process.exit(0);
}

const queue = {
    queue: targetSchools.map(r => ({
        university: r.university,
        missing: ['campUrl', 'dates', 'cost', 'email']
    }))
};

fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
console.log(`📋 Created queue with ${queue.queue.length} targets.`);

console.log('🚀 Running smart_extract.js...');
try {
    execSync('node smart_extract.js', { stdio: 'inherit' });
} catch (e) {
    console.error('Extraction failed:', e.message);
}

console.log('✨ Batch processing complete! Please review results then run `npm run generate:html` and `npm run deploy`.');
