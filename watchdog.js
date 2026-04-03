/**
 * watchdog.js
 * Monitors the NCAA Baseball Camp extraction script.
 * Restarts if no log file activity for 90 seconds.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'deep_url_audit.log');
const SCRIPT = 'deep_url_audit.js';
const INACTIVITY_TIME = 600000; // 600 seconds (10 minutes) for deep crawls/slow engines

let child = null;
let restartCount = 0;
let monitorInterval = null;

function logToWatchdog(msg) {
    console.log(`\n[WATCHDOG] [${new Date().toLocaleTimeString()}] ${msg}`);
}

function runScript() {
    logToWatchdog(`Starting extraction (Attempt #${++restartCount})...`);

    // Ensure we are in the correct directory
    const nodeArgs = process.argv.slice(2);
    child = spawn('node', [SCRIPT, ...nodeArgs], {
        cwd: __dirname,
        stdio: 'inherit'
    });

    child.on('close', (code) => {
        if (code === 88) {
            logToWatchdog(`Batch limit reached. Restarting immediately...`);
            child = null;
            setTimeout(runScript, 2000);
        } else if (code !== 0 && code !== null && child !== null) {
            logToWatchdog(`Script exited/killed (Code: ${code}). Restarting in 5s...`);
            child = null;
            setTimeout(runScript, 5000);
        } else if (code === 0) {
            logToWatchdog('Script finished successfully (Code 0).');
            process.exit(0);
        }
    });

    child.on('error', (err) => {
        logToWatchdog(`Child error: ${err.message}`);
    });
}

// Watchdog interval: Monitor Log File MTime
monitorInterval = setInterval(() => {
    if (child && child.pid) {
        try {
            if (!fs.existsSync(LOG_FILE)) return;
            const stats = fs.statSync(LOG_FILE);
            const now = Date.now();
            const diff = now - stats.mtimeMs;

            if (diff > INACTIVITY_TIME) {
                logToWatchdog(`! INACTIVITY DETECTED ! Log file hasn't changed for ${Math.round(diff/1000)}s.`);
                logToWatchdog(`Killing process tree for PID ${child.pid} and restarting...`);
                
                try {
                    // Robust Windows termination
                    execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
                } catch (e) {
                    // Fallback
                    child.kill('SIGKILL');
                }
                
                child = null; 
                setTimeout(runScript, 3000); 
            }
        } catch (e) {
            // Stats might fail during a write
        }
    }
}, 10000);

// Initial start
runScript();

process.on('SIGINT', () => {
    logToWatchdog('Stopping watchdog...');
    if (child) {
        try { execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' }); } catch(e) {}
    }
    clearInterval(monitorInterval);
    process.exit();
});
