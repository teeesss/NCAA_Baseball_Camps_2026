/**
 * watchdog_v7.js
 * Monitors the V7 NCAA Baseball Camp extraction script.
 * Restarts if no log file activity for 100 seconds.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'extraction_v7.log');
const SCRIPT = 'extract_camp_details_v7.js';
const INACTIVITY_TIME = 100000; // 100 seconds

let child = null;
let restartCount = 0;
let monitorInterval = null;

function logToWatchdog(msg) {
    console.log(`\n[WATCHDOG-V7] [${new Date().toLocaleTimeString()}] ${msg}`);
}

function runScript() {
    logToWatchdog(`Starting V7 extraction (Attempt #${++restartCount})...`);

    child = spawn('node', [SCRIPT], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        if (code !== 0 && code !== null && child !== null) {
            logToWatchdog(`Script exited (Code: ${code}). Restarting in 5s...`);
            child = null;
            setTimeout(runScript, 5000);
        } else if (code === 0) {
            logToWatchdog('V7 Extraction finished successfully!');
            process.exit(0);
        }
    });

    child.on('error', (err) => {
        logToWatchdog(`Child error: ${err.message}`);
    });
}

monitorInterval = setInterval(() => {
    if (child && child.pid) {
        try {
            if (!fs.existsSync(LOG_FILE)) return;
            const stats = fs.statSync(LOG_FILE);
            const diff = Date.now() - stats.mtimeMs;

            if (diff > INACTIVITY_TIME) {
                logToWatchdog(`INACTIVITY (${Math.round(diff/1000)}s). Killing PID ${child.pid} and restarting...`);
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
    logToWatchdog('Stopping watchdog...');
    if (child) {
        try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch(e) {}
    }
    clearInterval(monitorInterval);
    process.exit();
});
