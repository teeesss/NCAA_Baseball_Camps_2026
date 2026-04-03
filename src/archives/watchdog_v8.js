/**
 * watchdog_v8.js
 * Monitors extract_camp_details_v8.js and restarts if no log activity for 100s.
 */
const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const LOG_FILE       = path.join(__dirname, 'extraction_v8.log');
const SCRIPT         = 'extract_camp_details_v8.js';
const INACTIVITY_TIME = 100000; // 100 seconds

let child          = null;
let restartCount   = 0;
let monitorInterval = null;

function logWatchdog(msg) {
    console.log(`\n[WATCHDOG-V8] [${new Date().toLocaleTimeString()}] ${msg}`);
}

function runScript() {
    logWatchdog(`Starting V8 extraction (Attempt #${++restartCount})...`);

    child = spawn('node', [SCRIPT], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        if (code === 0) {
            logWatchdog('V8 Extraction finished successfully!');
            clearInterval(monitorInterval);
            process.exit(0);
        } else if (code !== null && child !== null) {
            logWatchdog(`Script exited (Code: ${code}). Restarting in 5s...`);
            child = null;
            setTimeout(runScript, 5000);
        }
    });

    child.on('error', (err) => {
        logWatchdog(`Child error: ${err.message}`);
    });
}

monitorInterval = setInterval(() => {
    if (child && child.pid) {
        try {
            if (!fs.existsSync(LOG_FILE)) return;
            const stats = fs.statSync(LOG_FILE);
            const diff  = Date.now() - stats.mtimeMs;

            if (diff > INACTIVITY_TIME) {
                logWatchdog(`INACTIVITY (${Math.round(diff / 1000)}s). Killing PID ${child.pid} and restarting...`);
                try {
                    execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
                } catch (e) {
                    child.kill('SIGKILL');
                }
                child = null;
                setTimeout(runScript, 3000);
            }
        } catch (e) {}
    }
}, 10000);

runScript();

process.on('SIGINT', () => {
    logWatchdog('Stopping watchdog...');
    if (child) {
        try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch(e) {}
    }
    clearInterval(monitorInterval);
    process.exit();
});
