/**
 * WATCHDOG V9 — NCAA Baseball Scraper
 * Monitors 'extraction_v9.log' for activity.
 * Restarts 'extract_camp_details_v9.js' if hung for 100s.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT   = 'extract_camp_details_v9.js';
const LOG_FILE = 'extraction_v9.log';
const TIMEOUT  = 100000; // 100 seconds

let lastSize = -1;
let subProcess = null;
let lastUpdate = Date.now();

function startScript() {
    console.log(`[WATCHDOG-V9] [${new Date().toLocaleTimeString()}] Starting V9 extraction (Attempt #1)...`);
    subProcess = spawn('node', [SCRIPT], { stdio: 'inherit', shell: true });

    subProcess.on('exit', (code) => {
        console.log(`[WATCHDOG-V9] Script exited with code ${code}. Restarting in 5s...`);
        setTimeout(startScript, 5000);
    });
}

function checkActivity() {
    try {
        if (!fs.existsSync(LOG_FILE)) return;
        const stats = fs.statSync(LOG_FILE);
        const size  = stats.size;

        if (size > lastSize) {
            lastSize = size;
            lastUpdate = Date.now();
        } else {
            const idle = Date.now() - lastUpdate;
            if (idle > TIMEOUT) {
                console.log(`[WATCHDOG-V9] [${new Date().toLocaleTimeString()}] 🚨 HANG DETECTED (${Math.floor(idle/1000)}s inactive). Killing and restarting...`);
                if (subProcess) {
                    // Force kill on Windows
                    const { exec } = require('child_process');
                    exec(`taskkill /F /T /PID ${subProcess.pid}`, () => {
                        console.log(`[WATCHDOG-V9] Process tree ${subProcess.pid} terminated.`);
                        startScript();
                    });
                } else {
                    startScript();
                }
                lastUpdate = Date.now();
            }
        }
    } catch (e) {
        console.error(`[WATCHDOG-V9] Check error: ${e.message}`);
    }
}

// Initial start
startScript();

// Monitor every 15s
setInterval(checkActivity, 15000);
