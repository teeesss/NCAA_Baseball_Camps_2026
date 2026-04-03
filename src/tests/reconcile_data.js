const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const VALID_MONTH_REGEX = /Jun|Jul|Aug|June|July|August|0[678]\//i;
const YEAR_REGEX = /2026/i;

function reconcile() {
    let modifiedCount = 0;

    data.forEach(item => {
        let needsUpdate = false;
        let allValidSessions = [];

        // 1. Gather all sessions from campTiers
        if (item.campTiers && Array.isArray(item.campTiers)) {
            item.campTiers.forEach(tier => {
                if (tier.sessions && Array.isArray(tier.sessions)) {
                    tier.sessions.forEach(session => {
                        if (session.dates && VALID_MONTH_REGEX.test(session.dates) && YEAR_REGEX.test(session.dates)) {
                            allValidSessions.push(session.dates);
                        }
                    });
                } else if (tier.dates && VALID_MONTH_REGEX.test(tier.dates) && YEAR_REGEX.test(tier.dates)) {
                    allValidSessions.push(tier.dates);
                }
            });
        }

        // 2. Synchronize Dates
        if (allValidSessions.length > 0) {
            // Deduplicate and format
            const uniqueDates = [...new Set(allValidSessions.map(d => d.trim()))];
            const newDatesString = uniqueDates.slice(0, 3).join(' | ') + (uniqueDates.length > 3 ? '...' : '');
            
            if (item.dates === 'TBA' || item.dates !== newDatesString) {
                // Check if current dates are invalid (e.g. November)
                const isCurrentDateInvalid = item.dates !== 'TBA' && !VALID_MONTH_REGEX.test(item.dates);
                if (item.dates === 'TBA' || isCurrentDateInvalid || (item.dates.length < newDatesString.length && item.dates.includes('...'))) {
                    console.log(`[${item.university}] Updating dates: ${item.dates} -> ${newDatesString}`);
                    item.dates = newDatesString;
                    needsUpdate = true;
                }
            }
        } else if (item.dates !== 'TBA' && !VALID_MONTH_REGEX.test(item.dates)) {
            // No valid sessions in tiers, and top-level date is invalid (e.g. November)
            console.log(`[${item.university}] Resetting invalid top-level dates: ${item.dates} -> TBA`);
            item.dates = 'TBA';
            needsUpdate = true;
        }

        // 3. Synchronize Cost
        if (item.cost === 'TBA' && item.campTiers && item.campTiers.length > 0) {
            const costs = item.campTiers
                .map(t => t.cost)
                .filter(c => c && c !== 'TBA' && c.includes('$'))
                .map(c => {
                    const m = c.match(/\$(\d+)/);
                    return m ? parseInt(m[1]) : null;
                })
                .filter(n => n !== null);
            
            if (costs.length > 0) {
                const minCost = Math.min(...costs);
                const newCostString = `$${minCost}.00+`;
                console.log(`[${item.university}] Updating cost: TBA -> ${newCostString}`);
                item.cost = newCostString;
                needsUpdate = true;
            }
        }

        if (needsUpdate) modifiedCount++;
    });

    if (modifiedCount > 0) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log(`\n✅ Reconciled ${modifiedCount} records.`);
    } else {
        console.log('\n✅ Data is already synchronized.');
    }
}

reconcile();
