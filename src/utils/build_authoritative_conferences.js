const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeWiki(url) {
    console.log("Fetching: " + url);
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'NCAA-Camp-Compiler/1.0 (rayjonesy@gmail.com)' } });
    const $ = cheerio.load(data);
    
    // Wikipedia lists of programs usually have tables with class 'wikitable'
    // Let's find tables and headers to map exactly.
    const mappings = {};
    
    $('table.wikitable').each((i, table) => {
        // Find header index
        let schoolIdx = -1;
        let confIdx = -1;
        
        const headers = $(table).find('tr').first().find('th, td');
        headers.each((j, th) => {
            const text = $(th).text().trim().toLowerCase();
            if (text.includes('school') || text.includes('institution') || text.includes('team')) schoolIdx = j;
            if (text.includes('conference')) confIdx = j;
        });
        
        if (schoolIdx !== -1 && confIdx !== -1) {
            $(table).find('tr').slice(1).each((j, tr) => {
                const cells = $(tr).find('td, th'); // Sometimes school is in a <th>
                // Handle mixed cells
                let sCell, cCell;
                if ($(tr).find('th').length > 0) {
                     sCell = $(tr).find('th');
                     cCell = $(cells).eq(confIdx);
                } else {
                     sCell = $(cells).eq(schoolIdx);
                     cCell = $(cells).eq(confIdx);
                     // If there's missing tds due to rowspan, it's safer to just pick text
                }
                
                let school = $(sCell).text().replace(/\[.*?\]/g, '').trim();
                let conf = $(cCell).text().replace(/\[.*?\]/g, '').trim();
                
                // Clean up footnotes and common artifacts
                school = school.replace(/\*/g, '').replace(/\^/g, '').trim();
                conf = conf.replace(/\*/g, '').replace(/\^/g, '').trim();
                
                if (school && conf && !school.includes("School") && school.length > 2) {
                    mappings[school] = conf;
                }
            });
        }
    });
    
    return mappings;
}

async function run() {
    const d1 = await scrapeWiki('https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_baseball_programs');
    const d2 = await scrapeWiki('https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_baseball_programs');
    
    console.log(`D1 length: ${Object.keys(d1).length}`);
    console.log(`D2 length: ${Object.keys(d2).length}`);
    
    // Output object
    const finalMap = { ...d2, ...d1 }; // D1 overwrites duplicates if any
    
    fs.writeFileSync('raw_authoritative_conferences.json', JSON.stringify(finalMap, null, 2));
    console.log(`Saved ${Object.keys(finalMap).length} records to raw_authoritative_conferences.json`);
}

run();
