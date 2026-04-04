const fs = require('fs');
const filePath = 'generate_html.js';
let content = fs.readFileSync(filePath, 'utf8');

// Target the block precisely to ensure 100% accuracy.
const lines = content.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('data-last-update="${item.lastUpdateDate') && 
        lines[i+3] && lines[i+3].includes('data-last-update="${item.lastUpdateDate')) {
        
        console.log(`Found duplicate last-update on lines ${i+1} and ${i+4}. Fixing...`);
        
        // Remove the duplicate (i+3) and insert data-dates-update at i+1
        const newLine = lines[i].replace('last-update', 'dates-update').replace('lastUpdateDate', 'datesUpdateDate');
        lines.splice(i + 3, 1); // remove duplicate
        lines.splice(i + 1, 0, newLine); // insert the new granular tag
        fixed = true;
        break;
    }
}

if (fixed) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log('SUCCESS: Granular timestamps integrated into card template.');
} else {
    console.error('ERROR: Could not find target card attributes for timestamp integration.');
    // Fallback search
    if (content.includes('data-last-update="${item.lastUpdateDate')) {
         console.log('Found individual tag - inserting after');
         content = content.replace('data-last-update="${item.lastUpdateDate || \'\'}"', 
                                   'data-last-update="${item.lastUpdateDate || \'\'}"\n                       data-dates-update="${item.datesUpdateDate || \'\'}"');
         fs.writeFileSync(filePath, content);
    }
}
