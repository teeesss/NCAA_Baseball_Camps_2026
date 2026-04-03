const fs = require('fs');

function parseMarkdownTable(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const data = [];
    let isTable = false;

    for (let line of lines) {
        if (line.includes('| University |')) {
            isTable = true;
            continue;
        }
        if (isTable && line.includes('| :--- |')) continue;
        if (isTable && line.startsWith('|')) {
            const parts = line.split('|').map(s => s.trim()).filter(s => s !== '');
            if (parts.length >= 6) {
                // Remove Markdown link syntax from URL [text](url)
                let url = parts[1];
                const urlMatch = url.match(/\[.*\]\((.*)\)/);
                if (urlMatch) url = urlMatch[1];

                // Remove Bold from University
                let univ = parts[0].replace(/\*\*/g, '');

                data.push({
                    university: univ,
                    campUrl: url,
                    dates: parts[2],
                    cost: parts[3],
                    details: parts[4],
                    contact: parts[5] === 'Not Listed' ? '' : parts[5],
                    division: 'DI'
                });
            }
        }
    }
    return data;
}

const existingData = parseMarkdownTable('additional.camps.full.txt');

// Add the few sample ones we verified manually/recently
const manuallyVerified = [
    {
        university: 'Alabama',
        campUrl: 'https://www.alabamabaseballcamps.com/',
        dates: 'Jun 15-18 / Jul 12-14 / Jul 27-30, 2026',
        cost: '$262.50 Youth / $1,312.50 Elite',
        details: 'Elite & Youth Camps at Sewell-Thomas Stadium.',
        contact: 'Rob Vaughn (Head Coach)',
        division: 'DI',
        address: 'Sewell-Thomas Stadium, 241 Paul W Bryant Dr, Tuscaloosa, AL 35401',
        whatToBring: 'Helmet, Bat, Batting Gloves, Glove, Cleats and turf shoes. Clearly marked with player\'s name.'
    },
    {
        university: 'Florida',
        campUrl: 'https://floridagators.com/sports/2026/2/18/baseball-summer-showcase-camp',
        dates: 'Jul 12, 2026 / Jul 26, 2026',
        cost: '$250',
        details: 'Summer Showcase Camp at Condron Ballpark.',
        contact: 'Kevin O\'Sullivan (Head Coach)',
        division: 'DI',
        address: 'Condron Ballpark, 2800 Citrus Road, Gainesville, FL 32608',
        whatToBring: 'Position specific instruction. Bring own baseball equipment.'
    },
    {
        university: 'Ole Miss',
        campUrl: 'https://baseball.olemisssportscamps.com/',
        dates: 'Jun 22-25 / Jul 13-16 / Jul 20-23, 2026',
        cost: '$341.25',
        details: 'Summer Baseball Camps at Swayze Field.',
        contact: 'Mike Bianco (Head Coach)',
        division: 'DI',
        address: 'Swayze Field, 101 Swayze Ln, University, MS 38677',
        whatToBring: 'Baseball equipment, clearly marked with name.'
    }
];

// Merge
const finalData = [...existingData];
manuallyVerified.forEach(mv => {
    const idx = finalData.findIndex(d => d.university.includes(mv.university));
    if (idx !== -1) {
        finalData[idx] = { ...finalData[idx], ...mv };
    } else {
        finalData.push(mv);
    }
});

fs.writeFileSync('camps_data.json', JSON.stringify(finalData, null, 2));
console.log(`Parsed and merged ${finalData.length} records into camps_data.json`);
