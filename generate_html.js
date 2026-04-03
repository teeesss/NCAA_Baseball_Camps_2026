const fs = require('fs');
const path = require('path');

// Load Data
const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const lastChecked = "April 2, 2026";

// Unique Conferences
const conferences = [...new Set(data.map(c => c.conference || 'Other'))].sort();

// Load Human Verifications
let humanVerifications = {};
if (fs.existsSync('human_verifications.json')) {
    try {
        humanVerifications = JSON.parse(fs.readFileSync('human_verifications.json', 'utf8'));
    } catch (e) {
        console.error('Error reading human_verifications.json:', e);
    }
}

const diCount = data.filter(d => d.division === 'DI').length;
const diiCount = data.filter(d => d.division === 'DII').length;

const priorityConfs = ["SEC", "ACC", "Big Ten", "Big 12", "Sun Belt", "Big West", "ASUN", "Ivy League"];
const otherConfs = conferences.filter(c => !priorityConfs.includes(c) && c !== 'Other');

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NCAA Baseball Camps Directory 2026 | Div 1 & Div 2</title>
    <meta name="description" content="The definitive, searchable guide to 2026 NCAA Div I and Div II baseball camps and prospect clinics.">
    
    <!-- Premium Typography -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-color: #05070a;
            --card-bg: rgba(255, 255, 255, 0.03);
            --card-hover-bg: rgba(255, 255, 255, 0.06);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-color: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.4);
            --border-color: rgba(255, 255, 255, 0.08);
            --card-border-hover: rgba(255, 255, 255, 0.2);
            --glass-bg: rgba(15, 23, 42, 0.8);
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --danger-color: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Inter', sans-serif;
            background-image: 
                radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 40%),
                radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.05) 0%, transparent 40%),
                linear-gradient(to bottom, #05070a, #0f172a);
            background-attachment: fixed;
            min-height: 100vh;
            padding-bottom: 80px;
            overflow-x: hidden;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            padding: 80px 20px 40px;
            position: relative;
        }

        .hero-badge {
            display: inline-block;
            background: rgba(59, 130, 246, 0.1);
            color: var(--accent-color);
            padding: 8px 20px;
            border-radius: 100px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 24px;
            border: 1px solid rgba(59, 130, 246, 0.2);
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: clamp(2.5rem, 8vw, 4rem);
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.1;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #fff 30%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            max-width: 700px;
            margin: 0 auto 30px;
            line-height: 1.6;
        }

        .last-checked {
            color: var(--text-secondary);
            font-size: 0.85rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .last-checked::before {
            content: ''; width: 8px; height: 8px; background: var(--success-color); border-radius: 50%; display: inline-block; box-shadow: 0 0 10px var(--success-color);
        }

        /* Controls Section */
        .controls-wrapper {
            position: sticky;
            top: 20px;
            z-index: 1000;
            margin-bottom: 50px;
        }

        .glass-panel {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .top-row {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }

        .filter-select {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: #fff;
            padding: 12px 16px;
            border-radius: 14px;
            font-size: 0.85rem;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 160px;
        }
        .filter-select:focus { border-color: var(--accent-color); background: rgba(255, 255, 255, 0.08); }
        .filter-select option { background: #0f172a; color: #fff; }

        .search-inner {
            position: relative;
            flex-grow: 1;
        }

        #searchInput {
            width: 100%;
            padding: 14px 20px 14px 50px;
            border-radius: 14px;
            border: 1px solid transparent;
            background: rgba(255, 255, 255, 0.05);
            color: white;
            font-size: 1rem;
            outline: none;
        }

        #searchInput:focus { background: rgba(255, 255, 255, 0.08); border-color: var(--accent-color); }

        .search-icon { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); pointer-events: none; }

        /* Filter Switch */
        .filter-tabs {
            display: flex;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px;
            border-radius: 14px;
            border: 1px solid var(--border-color);
            flex-wrap: wrap;
            gap: 6px;
        }

        #conf-tabs {
            display: flex;
            flex-wrap: wrap;
            padding: 0;
            gap: 8px;
            margin-top: 12px;
        }

        .conf-btn {
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            border: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            font-size: 0.75rem;
            padding: 0 16px;
            transition: all 0.2s ease;
            color: var(--text-secondary);
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }

        .conf-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--accent-color);
            transform: translateY(-2px);
            color: #fff;
        }

        .conf-btn.active {
            background: var(--accent-color);
            color: white;
            border-color: var(--accent-color);
            box-shadow: 0 8px 20px var(--accent-glow);
        }

        .filter-btn {
            padding: 10px 16px;
            border-radius: 10px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .filter-btn.active {
            background: var(--accent-color);
            color: white;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .stats-row { display: flex; gap: 10px; padding: 0 4px; flex-wrap: wrap; }
        .stat-bubble { background: rgba(255, 255, 255, 0.04); padding: 6px 14px; border-radius: 100px; font-size: 0.75rem; color: var(--text-secondary); border: 1px solid var(--border-color); }
        .stat-bubble strong { color: #fff; margin-right: 4px; }

        /* Grid */
        .camp-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }

        .camp-card {
            background: var(--card-bg);
            border-radius: 24px;
            border: 1px solid var(--border-color);
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            cursor: pointer;
            animation: fadeIn 0.5s ease backwards;
        }

        .camp-card:hover {
            background: var(--card-hover-bg);
            border-color: var(--card-border-hover);
            transform: translateY(-5px);
        }

        .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .univ-name { font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: #fff; font-weight: 700; line-height: 1.2; }
        .division-tag { font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; white-space: nowrap; }
        .tag-di { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .tag-dii { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
        
        .conference-tag { 
            background: rgba(139, 92, 246, 0.1); 
            color: #a78bfa; 
            padding: 4px 10px; 
            border-radius: 6px; 
            font-size: 0.65rem; 
            font-weight: 700; 
            text-transform: uppercase; 
            letter-spacing: 0.5px; 
            border: 1px solid rgba(139, 92, 246, 0.2); 
            margin-left: 6px; 
            white-space: nowrap;
        }
        
        .info-item { display: flex; align-items: center; gap: 10px; }
        .icon-box { width: 28px; height: 28px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-color); flex-shrink: 0; }
        .icon-box.dii { color: #a855f7; }
        .val-stack { display: flex; flex-direction: column; pointer-events: none; }
        .label { font-size: 0.6rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; pointer-events: none; }
        .value { font-size: 0.9rem; color: #fff; font-weight: 500; pointer-events: none; }
        .value.tba { color: var(--text-secondary); font-style: italic; pointer-events: none; }

        .info-stack { cursor: pointer; border-radius: 12px; transition: background 0.2s; padding: 4px; margin: -4px; flex-grow: 1; }
        .info-stack:hover { background: rgba(255,255,255,0.05); }

        /* Badges */
        .badges-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge { font-size: 0.65rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; border: 1px solid transparent; }
        .badge-manual { background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.3); }
        .badge-auto { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3); }
        .badge-partial { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
        .badge-human { background: rgba(168, 85, 247, 0.15); color: #c084fc; border-color: rgba(168, 85, 247, 0.3); }
        .badge-not { background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border-color: var(--border-color); }

        /* Detail Modal */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .modal-overlay.active { opacity: 1; pointer-events: all; }
        .modal-box {
            background: #0f172a; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px; padding: 32px; max-width: 600px; width: 90%;
            max-height: 85vh; overflow-y: auto; position: relative;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            transform: translateY(20px); transition: transform 0.3s ease;
        }
        .modal-overlay.active .modal-box { transform: translateY(0); }
        .close-btn {
            position: absolute; top: 16px; right: 20px; background: transparent; border: none;
            color: var(--text-secondary); font-size: 28px; cursor: pointer; transition: color 0.2s;
        }
        .close-btn:hover { color: #fff; }
        .drawer-sec { margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .drawer-sec:last-child { margin-bottom: 0; }
        .d-label { font-size: 0.7rem; color: var(--accent-color); font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
        .d-body { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; }

        /* Tier Table in Modal */
        .tier-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.8rem; }
        .tier-table th { text-align: left; padding: 8px 10px; background: rgba(59,130,246,0.1); color: #60a5fa; font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .tier-table td { padding: 8px 10px; color: #e2e8f0; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top; }
        .tier-table tr:last-child td { border-bottom: none; }
        .tier-table tr:hover td { background: rgba(255,255,255,0.03); }
        .tier-cost { color: #10b981; font-weight: 700; white-space: nowrap; }
        .tier-ages { color: #a78bfa; font-size: 0.75rem; }
        .tier-dates { color: var(--text-secondary); font-size: 0.75rem; }
        .contact-row { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
        .contact-label { font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; min-width: 90px; }
        .contact-value { color: #fff; font-size: 0.85rem; user-select: all; cursor: text; }

        .actions { display: flex; gap: 10px; padding-top: 15px; border-top: 1px solid var(--border-color); margin-top: auto; }
        .btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 0.8rem; font-weight: 700; text-align: center; cursor: pointer; text-decoration: none; border: none; transition: 0.2s; }
        .btn-visit { background: var(--accent-color); color: white; }
        .btn-visit:hover { background: #2563eb; }
        .btn-visit.btn-dii { background: #a855f7; }
        .btn-visit.btn-dii:hover { background: #9333ea; }
        .btn-details { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border-color); }
        .btn-details:hover { background: rgba(255,255,255,0.1); }
        .btn-human-verify { background: rgba(168, 85, 247, 0.1); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.2); }
        .btn-human-verify:hover { background: rgba(168, 85, 247, 0.2); }
        .btn-human-verify.voted { background: rgba(34, 197, 94, 0.2); color: #4ade80; border-color: rgba(34, 197, 94, 0.4); }

        /* Toast notifications */
        #toast {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #1e293b; color: #fff; padding: 12px 24px; border-radius: 12px;
            font-size: 0.9rem; font-weight: 500; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            z-index: 10000; opacity: 0; pointer-events: none; transition: opacity 0.3s;
            border: 1px solid var(--border-color);
        }
        #toast.show { opacity: 1; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
            .top-row { flex-direction: column; align-items: stretch; }
            .camp-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="hero-badge">Verified 2026 Season</div>
            <h1>NCAA Baseball Camps</h1>
            <p class="subtitle">The elite directory of 2026 baseball prospect clinics. Search 550+ Div I & Div II programs with verified registration links, direct costs, and camp contact details.</p>
            <div class="last-checked">Active Data Integrity Audit: 24h Pulse System</div>
        </header>

        <div class="controls-wrapper">
            <div class="glass-panel">
                <div class="top-row">
                    <div class="search-inner">
                        <svg class="search-icon icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="searchInput" placeholder="Search by University, Coach, or Keyword...">
                    </div>
                    <select id="costFilter" class="filter-select">
                        <option value="all">All Prices</option>
                        <option value="under150">Under $150</option>
                        <option value="under200">Under $200</option>
                        <option value="under250">Under $250</option>
                        <option value="under300">Under $300</option>
                        <option value="under350">Under $350</option>
                        <option value="under500">Under $500</option>
                        <option value="over500">$500 & Over</option>
                        <option value="tba">Price TBA</option>
                    </select>
                    <div class="filter-tabs">
                        <button class="filter-btn active" data-div="all">All</button>
                        <button class="filter-btn" data-div="DI">Div I</button>
                        <button class="filter-btn" data-div="DII">Div II</button>
                        <button class="filter-btn" data-div="dates">📅 With Dates</button>
                        <button class="filter-btn" data-div="auto">🤖 Verified Scans</button>
                        <button class="filter-btn" data-div="human">👤 Community Verified</button>
                    </div>
                </div>
                <div id="conf-tabs">
                    <button class="conf-btn filter-btn active" data-conf="all">All Conferences</button>
                    ${priorityConfs.map(c => `<button class="conf-btn filter-btn" data-conf="${c}">${c}</button>`).join('')}
                    
                    <select id="moreConfs" class="filter-select" style="min-width: 140px; height: 38px; padding: 0 12px; font-size: 0.75rem;">
                        <option value="none">More Conferences...</option>
                        ${otherConfs.map(c => `<option value="${c}">${c}</option>`).join('')}
                        <option value="Other">Other / Independent</option>
                    </select>
                </div>
                <div class="stats-row">
                    <div class="stat-bubble"><strong id="dispCount">${data.length}</strong> Results</div>
                    <div class="stat-bubble"><strong>${diCount}</strong> Div I</div>
                    <div class="stat-bubble"><strong>${diiCount}</strong> Div II</div>
                    <div class="stat-bubble"><strong>${data.filter(d => d.autoVerified).length}</strong> Verified Sessions</div>
                </div>
            </div>
        </div>

        <div class="camp-grid" id="campGrid">
            ${data.sort((a,b) => a.university.localeCompare(b.university)).map((item, index) => {
                const isTba = !item.dates || item.dates === 'TBA';
                let dateArr = isTba ? [] : item.dates.split(' | ');
                
                // Deduplicate and filter 2026
                dateArr = [...new Set(dateArr)].filter(d => /2026/i.test(d) || !/\d{4}/.test(d));

                let displayDates;
                if (dateArr.length === 0) {
                    displayDates = 'TBA';
                } else if (dateArr.length > 2) {
                    displayDates = dateArr.slice(0, 2).join(' | ') + ` <span style="color:var(--text-secondary);font-size:0.8em">... (+${dateArr.length - 2})</span>`;
                } else {
                    displayDates = dateArr.join(' | ');
                }

                const tagClass = item.division === 'DI' ? 'tag-di' : 'tag-dii';
                const accentClass = item.division === 'DI' ? '' : 'dii';
                const logoHtml = item.logoFile ? `<img src="${item.logoFile}" alt="Logo" style="width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;" onerror="this.style.display='none'" />` : '';
                
                const isManualVerif = !!item.isVerified;
                const isAutoVerif   = !!item.autoVerified;
                const isPartial     = !!item.autoVerifiedPartial;
                const humanCount    = humanVerifications[item.university] || 0;

                return `
                <div class="camp-card" 
                     onclick="openDetails(event, this)"
                     style="cursor: pointer;"
                     data-div="${item.division}" 
                     data-conference="${item.conference || 'Independent / Other'}"
                     data-cost="${item.cost || 'TBA'}"
                     data-has-dates="${dateArr.length > 0}"
                     data-verified-manual="${isManualVerif}" 
                     data-verified-auto="${isAutoVerif}" 
                     data-verified-human="${humanCount > 0}"
                     data-not-verified="${!isManualVerif && !isAutoVerif && !isPartial}"
                     data-search="${item.university.toLowerCase()} ${item.contact.toLowerCase()}" 
                     style="animation-delay: ${index * 0.005}s">
                    
                    <div class="card-header">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${logoHtml}
                                <div class="univ-name">${item.university}</div>
                            </div>
                            <div class="badges-row">
                                ${isManualVerif ? '<span class="badge badge-manual">★ Manually Verified</span>' :
                                  isAutoVerif || isPartial ? '<span class="badge badge-auto">🤖 Automated Scan</span>' :
                                  '<span class="badge badge-not">❓ Not Verified</span>'}
                            </div>
                        </div>
                        <div class="division-tag ${tagClass}">${item.division === 'DI' ? 'Div I' : 'Div II'}</div>
                        ${item.conference && item.conference !== 'Other' ? `<div class="conference-tag">${item.conference}</div>` : ''}
                    </div>
                    
                    <div class="info-stack">
                        <div class="info-item">
                            <div class="icon-box ${accentClass}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <div class="val-stack">
                                <span class="label">Camp Dates</span>
                                <span class="value ${isTba ? 'tba' : ''}">${displayDates}</span>
                            </div>
                        </div>

                        <div class="info-item">
                            <div class="icon-box ${accentClass}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            </div>
                            <div class="val-stack">
                                <span class="label">Est. Cost</span>
                                <span class="value">${item.cost || 'Contact for pricing'}</span>
                            </div>
                        </div>

                        <div class="info-item">
                            <div class="icon-box ${accentClass}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <div class="val-stack">
                                <span class="label">Camp Contact</span>
                                <span class="value">${item.contact || 'Athletics Office'}</span>
                            </div>
                        </div>
                    </div>

                    <template class="modal-template">
                        <div style="font-family:'Outfit', sans-serif; font-size:1.6rem; color:#fff; font-weight:700; margin-bottom: 24px; padding-right:30px;">
                            ${item.university} Details
                        </div>
                        <div class="drawer-sec">
                            <div class="d-label">Contacts</div>
                            <div class="d-body">
                                <div class="contact-row">
                                    <span class="contact-label">Head Coach:</span>
                                    <span class="contact-value">${item.contact || 'Athletics Office'}</span>
                                </div>
                                ${item.campPOC ? `<div class="contact-row">
                                    <span class="contact-label">Camp POC:</span>
                                    <span class="contact-value">${item.campPOC}</span>
                                </div>` : ''}
                                ${item.email ? `<div class="contact-row">
                                    <span class="contact-label">Email:</span>
                                    <span class="contact-value"><a href="mailto:${item.email}" style="color:#60a5fa;text-decoration:none;">${item.email}</a></span>
                                </div>` : ''}
                            </div>
                        </div>
                        <div class="drawer-sec">
                            <div class="d-label">Verification Source</div>
                            <div class="d-body" style="display: flex; gap: 8px; margin-top: 8px;">
                                ${isManualVerif ? '<span class="badge badge-manual">★ Manually Verified</span>' :
                                  isAutoVerif || isPartial ? '<span class="badge badge-auto">🤖 Automated Scan</span>' :
                                  '<span class="badge badge-not">❓ Not Verified</span>'}
                            </div>
                        </div>
                        ${(() => {
                            // Pricing / Camp Tiers section
                            if (item.campTiers && item.campTiers.length > 0) {
                                return '<div class="drawer-sec" style="border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.03);">' +
                                    '<div class="d-label" style="color:#10b981;">💰 Camp Pricing & Tiers</div>' +
                                    '<div class="d-body">' +
                                    '<table class="tier-table">' +
                                    '<thead><tr><th>Camp</th><th>Ages</th><th>Cost</th><th>Dates</th></tr></thead>' +
                                    '<tbody>' +
                                    item.campTiers.map(t => {
                                        const tierDates = t.sessions ? t.sessions.map(s => (s.dates || '') + (s.time ? ' ' + s.time : '')).join('<br>') : '';
                                        return '<tr>' +
                                            '<td style="font-weight:600;color:#fff;">' + (t.name || 'Camp') + '</td>' +
                                            '<td class="tier-ages">' + (t.ages || '-') + '</td>' +
                                            '<td class="tier-cost">' + (t.cost || 'TBA') + '</td>' +
                                            '<td class="tier-dates">' + (tierDates || 'TBA') + '</td>' +
                                            '</tr>';
                                    }).join('') +
                                    '</tbody></table></div></div>';
                            } else if (item.cost && item.cost !== 'TBA' && item.cost !== 'Contact for pricing') {
                                return '<div class="drawer-sec" style="border-color: rgba(16,185,129,0.2); background: rgba(16,185,129,0.03);">' +
                                    '<div class="d-label" style="color:#10b981;">💰 Estimated Cost</div>' +
                                    '<div class="d-body" style="font-size:1.1rem;color:#10b981;font-weight:700;">' + item.cost + '</div>' +
                                    '</div>';
                            } else {
                                return '<div class="drawer-sec">' +
                                    '<div class="d-label">💰 Pricing</div>' +
                                    '<div class="d-body" style="color:var(--text-secondary);font-style:italic;">Cost: TBA — Check camp site for pricing details</div>' +
                                    '</div>';
                            }
                        })()}
                        ${dateArr.length > 0 ? `
                        <div class="drawer-sec">
                            <div class="d-label">📅 All Available Dates</div>
                            <div class="d-body">
                                <ul style="margin: 0; padding-left: 18px;">
                                    ${dateArr.map(d => `<li style="margin-bottom:6px; color: #fff;">${d}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        ` : ''}
                        ${item.details ? `
                        <div class="drawer-sec">
                            <div class="d-label">Additional Intel</div>
                            <div class="d-body">${item.details}</div>
                        </div>` : ''}
                        <div class="drawer-sec" style="border-color: rgba(59, 130, 246, 0.2); background: rgba(59, 130, 246, 0.05);">
                            <div class="d-label">🔗 Camp Hub</div>
                            <div class="d-body">
                                ${item.campUrl ? `<a href="${item.campUrl}" target="_blank" style="color: var(--accent-color); font-weight:700; word-break: break-all;">${item.campUrl}</a>` : '<span style="color:var(--text-secondary);font-style:italic;">No camp URL available</span>'}
                            </div>
                        </div>
                        <div style="margin-top: 20px; font-size: 0.8rem; text-align: center;">
                            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=rayjonesy@gmail.com&su=Camp%20Data%20Fix:%20${encodeURIComponent(item.university)}&body=Please%20describe%20the%20missing%20or%20incorrect%20data%20for%20${encodeURIComponent(item.university)}:"
                               target="_blank" 
                               style="color: var(--danger-color); font-weight: 600; text-decoration: none; border-bottom: 1px dotted var(--danger-color);">
                                ⚠️ Report Missing or Incorrect Data
                            </a>
                        </div>
                    </template>

                    <div class="actions">
                        <a href="${item.campUrl || '#'}" 
                           class="btn btn-visit ${item.division === 'DII' ? 'btn-dii' : ''}" 
                           target="_blank" 
                           onclick="event.stopPropagation()"
                           ${!item.campUrl || item.campUrl.includes('google.com/search') ? 'style="opacity: 0.3; cursor: not-allowed;" onclick="return false"' : ''}>
                           Visit Site
                        </a>
                        <button class="btn btn-human-verify" onclick="communityVerify(event, this, '${item.university.replace(/'/g, "\\'")}')">
                            👤 <span>${humanCount > 0 ? humanCount : ''}</span> Verify
                        </button>
                        <button class="btn btn-details" onclick="openDetails(event, this)">Details</button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    </div>

    <div id="globalModal" class="modal-overlay">
        <div class="modal-box">
            <button id="closeModal" class="close-btn">&times;</button>
            <div id="modalBody"></div>
        </div>
    </div>

    <div id="toast"></div>

    <script>
        const searchInput = document.getElementById('searchInput');
        const campCards   = document.querySelectorAll('.camp-card');
        const dispCount   = document.getElementById('dispCount');
        const filterBtns  = document.querySelectorAll('.filter-btn');
        const toast       = document.getElementById('toast');
        
        let currentDiv = 'all';
        let currentConf = 'all';

        function showToast(msg) {
            toast.innerText = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        const votedInSession = JSON.parse(localStorage.getItem('votedSchools') || '[]');

        function filter() {
            const term = searchInput.value.toLowerCase();
            const costFilter = document.getElementById('costFilter').value;
            const confFilter = currentConf;
            let count = 0;
            
            campCards.forEach(card => {
                const searchTxt = card.getAttribute('data-search');
                const div = card.getAttribute('data-div');
                const conf = card.getAttribute('data-conference');
                const cost = card.getAttribute('data-cost');
                
                const isAuto    = card.getAttribute('data-verified-auto') === 'true';
                const isHuman   = card.getAttribute('data-verified-human') === 'true';
                
                const matchesSearch = searchTxt.includes(term);
                let matchesFilter = true;

                if (currentDiv === 'DI' || currentDiv === 'DII') matchesFilter = div === currentDiv;
                else if (currentDiv === 'auto') matchesFilter = isAuto;
                else if (currentDiv === 'human') matchesFilter = isHuman;
                else if (currentDiv === 'dates') matchesFilter = card.getAttribute('data-has-dates') === 'true';

                const matchesConf = (confFilter === 'all' || conf === confFilter);
                
                let matchesCost = true;
                if (costFilter !== 'all') {
                    const priceString = cost.replace(/[^0-9]/g, "");
                    const price = priceString ? parseInt(priceString) : 0;
                    
                    if (costFilter === 'under150') matchesCost = (price > 0 && price < 150);
                    else if (costFilter === 'under200') matchesCost = (price > 0 && price < 200);
                    else if (costFilter === 'under250') matchesCost = (price > 0 && price < 250);
                    else if (costFilter === 'under300') matchesCost = (price > 0 && price < 300);
                    else if (costFilter === 'under350') matchesCost = (price > 0 && price < 350);
                    else if (costFilter === 'under500') matchesCost = (price > 0 && price < 500);
                    else if (costFilter === 'over500') matchesCost = (price >= 500);
                    else if (costFilter === 'tba') matchesCost = (price === 0 || cost.toLowerCase().includes('tba') || cost.toLowerCase().includes('contact'));
                }
                
                if (matchesSearch && matchesFilter && matchesConf && matchesCost) {
                    card.style.display = 'flex';
                    count++;
                } else {
                    card.style.display = 'none';
                }
            });
            dispCount.innerText = count;
        }

        searchInput.addEventListener('input', filter);
        document.getElementById('costFilter').addEventListener('change', filter);
        
        document.querySelectorAll('.filter-tabs:not(#conf-tabs) .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tabs:not(#conf-tabs) .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentDiv = btn.getAttribute('data-div');
                filter();
            });
        });

        const moreConfsSelect = document.getElementById('moreConfs');

        document.querySelectorAll('#conf-tabs .conf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#conf-tabs .conf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentConf = btn.getAttribute('data-conf');
                moreConfsSelect.value = "none"; // Reset dropdown
                filter();
            });
        });

        moreConfsSelect.addEventListener('change', () => {
            if (moreConfsSelect.value !== "none") {
                // Reset all priority buttons
                document.querySelectorAll('#conf-tabs .conf-btn').forEach(b => b.classList.remove('active'));
                currentConf = moreConfsSelect.value;
                filter();
            } else {
                // If they pick the "More..." placeholder, we could revert to All or just do nothing
                // Let's just leave it for now.
            }
        });

        // Community Verify Logic
        async function communityVerify(event, btn, schoolName) {
            event.stopPropagation();
            if (btn.classList.contains('voted')) return;

            if (votedInSession.includes(schoolName)) {
                btn.classList.add('voted');
                showToast("You've already verified this school.");
                return;
            }

            if (!confirm('Are you verifying that ' + schoolName + ' camp data is accurate?')) return;

            try {
                const response = await fetch('verify_human.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolName, action: 'verify' })
                });
                const result = await response.json();

                if (result.success) {
                    const span = btn.querySelector('span');
                    span.innerText = result.count;
                    btn.classList.add('voted');
                    votedInSession.push(schoolName);
                    localStorage.setItem('votedSchools', JSON.stringify(votedInSession));
                    showToast("Verified! Thank you.");
                } else {
                    showToast(result.message || "Error verifying.");
                }
            } catch (err) {
                showToast("Server error.");
            }
        }

        // Modal Logic
        const modal = document.getElementById('globalModal');
        const modalBody = document.getElementById('modalBody');
        const closeModal = document.getElementById('closeModal');
        
        closeModal.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        function openDetails(event, btn) {
            event.stopPropagation();
            const card = btn.closest('.camp-card');
            const template = card.querySelector('.modal-template');
            modalBody.innerHTML = template.innerHTML;
            modal.classList.add('active');
        }

        // Initialize state
        window.addEventListener('load', () => {
            document.querySelectorAll('.btn-human-verify').forEach(btn => {
                const text = btn.getAttribute('onclick');
                const match = text.match(/'(.*)'/);
                if (match && votedInSession.includes(match[1])) btn.classList.add('voted');
            });
        });
    </script>
</body>
</html>
`;

fs.writeFileSync('index.html', html);
console.log('Regenerated searchable index.html with Auto & Human Verification systems.');
