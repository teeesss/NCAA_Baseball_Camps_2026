const fs = require('fs');

const data = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));
const verified = JSON.parse(fs.readFileSync('verified/arkansas.json', 'utf8'));

const ark = data.find(d => d.university === 'Arkansas');
if (ark) {
    // Clear out any old garbage data
    ark.details = "Join the Razorback Baseball Coaching Staff and players for instruction on the fundamentals and skills of the game at Baum-Walker Stadium and the Fowler Family Baseball Indoor Training Center.";
    ark.whatToBring = "Players should bring a bat, helmet, glove, cleats, turf shoes/sneakers, and catchers gear (if applicable).";
    ark.address = "Baum-Walker Stadium, Fayetteville, AR";
    ark.contact = "Arkansas Baseball Staff"; 

    ark.campUrl = verified.campUrl;
    ark.campTiers = verified.campTiers;

    // Filter ages 12+ 
    let allDates = [];
    let costs = [];
    for (let tier of verified.campTiers) {
        let ageText = tier.ages;
        let minAge = 0, maxAge = 99;
        let m = ageText.match(/(\d+)\s*[-–]\s*(\d+)/);
        if (m) { minAge = parseInt(m[1]); maxAge = parseInt(m[2]); }
        let m2 = ageText.match(/(\d+)\s*\+/);
        if (m2) { minAge = parseInt(m2[1]); maxAge = 99; }
        if (ageText.includes('8th')) { minAge = 13; maxAge = 18; }
        
        if (maxAge < 12) continue;
        
        for (let s of tier.sessions) allDates.push(s.dates.replace(', 2026', ''));
        let cost = parseFloat(tier.cost.replace('$', ''));
        if (cost > 0) costs.push(cost);
    }
    
    ark.dates = [...new Set(allDates)].join(' | ') + ' 2026';
    if (costs.length > 0) {
        let min = Math.min(...costs);
        let max = Math.max(...costs);
        ark.cost = min === max ? `$${min}` : `$${min} - $${max}`;
    }
    
    ark.isVerified = true;
    ark.isChecked = true;
    ark.scriptVersion = 3;

    fs.writeFileSync('camps_data.json', JSON.stringify(data, null, 2));
    
    // Also save the full cleanup back to the verified file
    verified.details = ark.details;
    verified.whatToBring = ark.whatToBring;
    verified.address = ark.address;
    verified.contact = ark.contact;
    fs.writeFileSync('verified/arkansas.json', JSON.stringify(verified, null, 2));
    
    console.log('Arkansas details scrubbed and updated.');
}
