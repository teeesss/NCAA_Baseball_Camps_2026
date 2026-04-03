const fs = require('fs');

const d2File = "C:\\Users\\rayjo\\.gemini\\antigravity\\brain\\d7132ad5-9655-481a-a36e-225a4f998064\\.system_generated\\steps\\154\\content.md";
const content = fs.readFileSync(d2File, 'utf8');

const schools = [];
// Regex for: [School Name](URL) where URL contains athletic-scholarships/baseball
const regex = /\[(.*?)\]\((https:\/\/www\.ncsasports\.org\/athletic-scholarships\/baseball\/.*?)\)/g;
let match;

while ((match = regex.exec(content)) !== null) {
    const rawName = match[1].trim();
    if (!schools.some(s => s.university === rawName)) {
        schools.push({
            university: rawName,
            campUrl: "",
            dates: "TBA",
            cost: "TBA",
            details: "No 2026 camps posted as of April 2, 2026",
            contact: "Head Coach (TBA)",
            division: "DII",
            address: "On-campus facility",
            whatToBring: "Glove, bat, helmet, cleats, baseball pants, water bottle, sunscreen."
        });
    }
}

console.log(`Extracted ${schools.length} DII schools.`);

const masterData = JSON.parse(fs.readFileSync('camps_data.json', 'utf8'));

// Filter out schools that are already in the database
let addedCount = 0;
schools.forEach(s => {
    if (!masterData.some(m => m.university === s.university)) {
        masterData.push(s);
        addedCount++;
    }
});

fs.writeFileSync('camps_data.json', JSON.stringify(masterData, null, 2));
console.log(`Added ${addedCount} new DII schools. Total programs: ${masterData.length}`);
