const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');

const { window } = new JSDOM(html, {
    url: 'http://localhost',
    runScripts: 'dangerously',
    resources: 'usable'
});

window.onerror = function(msg, file, line, col, error) {
    console.error(`💥 JSDOM UNCAUGHT ERROR: ${msg} at line ${line}`);
    process.exit(1);
};

window.addEventListener('unhandledrejection', (event) => {
    console.error(`💥 JSDOM PROMISE ERROR: ${event.reason}`);
    process.exit(1);
});

// Wait a second for boot script to run
setTimeout(() => {
    if (window.document.getElementById('loading-overlay').style.display !== 'none') {
        console.error('💥 OVERLAY DID NOT HIDE! Init stalled.');
    } else {
        console.log('✅ Overaly hid successfully!');
    }
    process.exit(0);
}, 2000);
