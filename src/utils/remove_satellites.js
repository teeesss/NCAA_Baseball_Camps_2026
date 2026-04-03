const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../camps_data.json');

// List of branch/satellite keywords or patterns to remove
const SATELLITE_PATTERNS = [
    ' – ', // En Dash usually indicates branch
    ' - ',  // Hyphen version
];

// Exceptions that ARE independent programs (NCAA DI or major DII we want to keep)
const INDEPENDENT_EXCEPTIONS = [
    'Texas A&M-Corpus Christi',
    'Arkansas-Pine Bluff',
    'UT Martin',
    'UT Arlington',
    'UTRGV',
    'UNC Wilmington',
    'UNC Asheville',
    'UNC Greensboro',
    'USC Upstate',
    'LIU Brooklyn',
    'LIU Post',
    'Cal State Bakersfield',
    'Cal State Fullerton',
    'Cal State Northridge',
    'Cal State San Marcos',
    'Cal State Stanislaus',
    'California State – Chico',
    'California State – Monterey Bay'
];

function cleanSatellites() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file not found');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const initialCount = data.length;

    const filtered = data.filter(school => {
        const name = school.university;
        
        // If it's in our exception list, keep it
        if (INDEPENDENT_EXCEPTIONS.some(ex => name.includes(ex))) return true;

        // If it has a satellite pattern, remove it
        if (SATELLITE_PATTERNS.some(p => name.includes(p))) {
            console.log(`🗑️ Removing Satellite: ${name}`);
            return false;
        }

        return true;
    });

    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
    console.log(`\n✅ Cleaned up satellites.`);
    console.log(`📊 Initial: ${initialCount} | Removed: ${initialCount - filtered.length} | Remaining: ${filtered.length}`);
}

cleanSatellites();
