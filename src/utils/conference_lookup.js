/**
 * NCAA Baseball Programs — Conference Lookup
 * Maps University names (exact match or substring) to their Athletic Conference.
 */

const CONFERENCE_LOOKUP = {
  // ── SEC (Southeastern Conference) ──────────────────────────
  'Alabama': 'SEC', 'Arkansas': 'SEC', 'Auburn': 'SEC', 'Florida': 'SEC', 'Georgia': 'SEC',
  'Kentucky': 'SEC', 'LSU': 'SEC', 'Mississippi State': 'SEC', 'Missouri': 'SEC', 'Ole Miss': 'SEC',
  'South Carolina': 'SEC', 'Tennessee': 'SEC', 'Texas A&M': 'SEC', 'Vanderbilt': 'SEC', 'Oklahoma': 'SEC', 'Texas': 'SEC',

  // ── ACC (Atlantic Coast Conference) ─────────────────────────
  'Boston College': 'ACC', 'Clemson': 'ACC', 'Duke': 'ACC', 'Florida State': 'ACC', 'Georgia Tech': 'ACC',
  'Louisville': 'ACC', 'Miami': 'ACC', 'North Carolina': 'ACC', 'North Carolina State': 'ACC', 'Notre Dame': 'ACC',
  'Pittsburgh': 'ACC', 'Virginia': 'ACC', 'Virginia Tech': 'ACC', 'Wake Forest': 'ACC', 'Stanford': 'ACC', 'California': 'ACC', 'SMU': 'ACC',

  // ── Big Ten ───────────────────────────────────────────────
  'Illinois': 'Big Ten', 'Indiana': 'Big Ten', 'Iowa': 'Big Ten', 'Maryland': 'Big Ten', 'Michigan': 'Big Ten',
  'Michigan State': 'Big Ten', 'Minnesota': 'Big Ten', 'Nebraska': 'Big Ten', 'Northwestern': 'Big Ten', 'Ohio State': 'Big Ten',
  'Penn State': 'Big Ten', 'Purdue': 'Big Ten', 'Rutgers': 'Big Ten', 'Oregon': 'Big Ten', 'UCLA': 'Big Ten', 'USC': 'Big Ten', 'Washington': 'Big Ten',

  // ── Big 12 ───────────────────────────────────────────────
  'Arizona': 'Big 12', 'Arizona State': 'Big 12', 'Baylor': 'Big 12', 'BYU': 'Big 12', 'Cincinnati': 'Big 12',
  'Houston': 'Big 12', 'Kansas': 'Big 12', 'Kansas State': 'Big 12', 'Oklahoma State': 'Big 12', 'TCU': 'Big 12',
  'Texas Tech': 'Big 12', 'UCF': 'Big 12', 'Utah': 'Big 12', 'West Virginia': 'Big 12',

  // ── Pac-12 (Remaining) ───────────────────────────────────
  'Oregon State': 'Pac-12', 'Washington State': 'Pac-12',

  // ── SWAC (Southwestern Athletic Conference) ────────────────
  'Alabama A&M': 'SWAC', 'Alabama State': 'SWAC', 'Alcorn State': 'SWAC', 'Bethune-Cookman': 'SWAC',
  'Jackson State': 'SWAC', 'Mississippi Valley State': 'SWAC', 'Prairie View A&M': 'SWAC', 'Southern University': 'SWAC',
  'Texas Southern': 'SWAC', 'Arkansas-Pine Bluff': 'SWAC', 'Grambling State': 'SWAC',

  // ── Sun Belt ──────────────────────────────────────────────
  'Appalachian State': 'Sun Belt', 'Arkansas State': 'Sun Belt', 'Coastal Carolina': 'Sun Belt', 'Georgia Southern': 'Sun Belt',
  'Georgia State': 'Sun Belt', 'James Madison': 'Sun Belt', 'Louisiana': 'Sun Belt', 'ULM': 'Sun Belt',
  'Marshall': 'Sun Belt', 'Old Dominion': 'Sun Belt', 'South Alabama': 'Sun Belt', 'Southern Miss': 'Sun Belt',
  'Texas State': 'Sun Belt', 'Troy': 'Sun Belt',

  // ── Mid-Major DI ─────────────────────────────────────────
  'Abilene Christian': 'WAC', 'Air Force': 'Mountain West', 'Albany': 'America East', 
  'Army': 'Patriot', 'Ball State': 'MAC', 'Belmont': 'MVC', 'Binghamton': 'America East',
  'Bowling Green': 'MAC', 'Bradley': 'MVC', 'Bryant': 'America East', 'Bucknell': 'Patriot', 'Butler': 'Big East',
  'Cal State Bakersfield': 'Big West', 'California Baptist': 'WAC', 'Campbell': 'CAA', 'Canisius': 'MAAC',
  'Central Connecticut': 'NEC', 'Central Michigan': 'MAC', 'Charlotte': 'AAC', 'College of Charleston': 'CAA', 
  'Creighton': 'Big East', 'Dallas Baptist': 'CUSA', 'Davidson': 'Atlantic 10',
  'Dayton': 'Atlantic 10', 'Delaware': 'CAA', 'Delaware State': 'NEC', 'East Carolina': 'AAC', 'Eastern Kentucky': 'ASUN',
  'Eastern Michigan': 'MAC', 'Elon': 'CAA', 'Evansville': 'MVC', 'Fairfield': 'MAAC', 'Florida Atlantic': 'AAC',
  'Florida Gulf Coast': 'ASUN', 'Fordham': 'Atlantic 10', 'Fresno State': 'Mountain West', 'Furman': 'Southern',
  'Gardner-Webb': 'Big South', 'George Mason': 'Atlantic 10', 'George Washington': 'Atlantic 10', 'Georgetown': 'Big East',
  'Gonzaga': 'WCC', 'Grand Canyon': 'WAC', 'High Point': 'Big South', 'Hofstra': 'CAA', 'Holy Cross': 'Patriot',
  'Houston Christian': 'Southland', 'Illinois State': 'MVC', 'Incarnate Word': 'Southland', 'Iona': 'MAAC',
  'Jacksonville': 'ASUN', 'Jacksonville State': 'CUSA', 'Kennesaw State': 'CUSA',
  'Kent State': 'MAC', 'La Salle': 'Atlantic 10', 'Lafayette': 'Patriot', 'Lamar': 'Southland', 'Lehigh': 'Patriot',
  'Liberty': 'CUSA', 'Lipscomb': 'ASUN', 'Little Rock': 'OVC', 'Louisiana Tech': 'CUSA', 'Loyola Marymount': 'WCC',
  'Maine': 'America East', 'Manhattan': 'MAAC', 'Marist': 'MAAC', 'McNeese': 'Southland', 'Memphis': 'AAC',
  'Mercer': 'Southern', 'Middle Tennessee': 'CUSA', 'Milwaukee': 'Horizon', 'Missouri State': 'MVC', 'Monmouth': 'CAA',
  'Morehead State': 'OVC', 'Mount St. Mary\'s': 'MAAC', 'Murray State': 'MVC', 'Navy': 'Patriot', 'NJIT': 'America East',
  'New Mexico': 'Mountain West', 'New Mexico State': 'CUSA', 'Niagara': 'MAAC', 'Nicholls': 'Southland',
  'North Alabama': 'ASUN', 'North Carolina A&T': 'CAA', 'North Dakota State': 'Summit', 'North Florida': 'ASUN',
  'Northeastern': 'CAA', 'Northern Colorado': 'Summit', 'Northern Illinois': 'MAC', 'Northwestern State': 'Southland',
  'Oakland': 'Horizon', 'Ohio': 'MAC', 'Oral Roberts': 'Summit', 'Pacific': 'WCC', 'Pepperdine': 'WCC',
  'Portland': 'WCC', 'Presbyterian': 'Big South', 'Quinnipiac': 'MAAC', 'Radford': 'Big South', 'Rhode Island': 'Atlantic 10',
  'Rice': 'AAC', 'Richmond': 'Atlantic 10', 'Rider': 'MAAC', 'Sacramento State': 'WAC', 'Sacred Heart': 'NEC',
  'Saint Joseph\'s': 'Atlantic 10', 'Saint Louis': 'Atlantic 10', 'Saint Mary\'s': 'WCC', 'Sam Houston': 'CUSA',
  'Samford': 'Southern', 'San Diego': 'WCC', 'San Diego State': 'Mountain West', 'San Francisco': 'WCC',
  'San Jose State': 'Mountain West', 'Santa Clara': 'WCC', 'Seattle': 'WAC', 'Seton Hall': 'Big East',
  'Siena': 'MAAC', 'SIUE': 'OVC', 'South Dakota State': 'Summit', 'South Florida': 'AAC', 'Southeast Missouri': 'OVC',
  'Southeastern Louisiana': 'Southland', 'Southern Illinois': 'MVC', 'St. Bonaventure': 'Atlantic 10',
  'St. John\'s': 'Big East', 'St. Thomas': 'Summit', 'Stephen F. Austin': 'Southland', 'Stetson': 'ASUN',
  'Stony Brook': 'CAA', 'Tarleton State': 'WAC', 'Temple': 'AAC', 'Tennessee Tech': 'OVC', 'Texas A&M-Corpus Christi': 'Southland',
  'The Citadel': 'Southern', 'Toledo': 'MAC', 'Towson': 'CAA', 'Tulane': 'AAC',
  'UAB': 'AAC', 'UC Davis': 'Big West', 'UC Irvine': 'Big West', 'UC Riverside': 'Big West', 'UC San Diego': 'Big West',
  'UC Santa Barbara': 'Big West', 'UMass': 'Atlantic 10', 'UMass Lowell': 'America East', 'UMBC': 'America East',
  'UNC Asheville': 'Big South', 'UNC Greensboro': 'Southern', 'UNC Wilmington': 'CAA', 'UNLV': 'Mountain West',
  'USC Upstate': 'Big South', 'UT Arlington': 'WAC', 'UT Martin': 'OVC', 'Utah Tech': 'WAC', 'Utah Valley': 'WAC',
  'UTRGV': 'Southland', 'Valparaiso': 'MVC', 'VCU': 'Atlantic 10', 'Villanova': 'Big East', 'VMI': 'Southern',
  'Wagner': 'NEC', 'Western Carolina': 'Southern', 'Western Illinois': 'OVC', 'Western Kentucky': 'CUSA',
  'Western Michigan': 'MAC', 'Wichita State': 'AAC', 'William & Mary': 'CAA', 'Winthrop': 'Big South',
  'Wofford': 'Southern', 'Wright State': 'Horizon', 'Xavier': 'Big East', 'Youngstown State': 'Horizon',

  // ── D2 Conferences ──────────────────────────────────────
  'Adams State': 'RMAC', 'Adelphi': 'NE10', 'Albany State': 'SIAC', 'American International': 'NE10',
  'Angelo State': 'Lone Star', 'Arkansas Tech': 'GAC', 'Ashland': 'GMAC', 'Assumption': 'NE10',
  'Augusta': 'Peach Belt', 'Augustana': 'NSIC', 'Azusa Pacific': 'PacWest', 'Barry': 'Sunshine State',
  'Barton': 'Conference Carolinas', 'Bemidji State': 'NSIC', 'Benedict': 'SIAC', 'Bentley': 'NE10',
  'Biola': 'PacWest', 'Bloomfield': 'CACC', 'Bloomsburg': 'PSAC', 'Bluefield State': 'Independent',
  'Caldwell': 'CACC', 'California State Polytechnic – Pomona': 'CCAA', 'California State – Chico': 'CCAA',
  'California State – Dominguez Hills': 'CCAA', 'California State – East Bay': 'CCAA', 'California State – Los Angeles': 'CCAA',
  'California State – Monterey Bay': 'CCAA', 'California State – San Bernardino': 'CCAA', 'California State – San Marcos': 'CCAA',
  'California State – Stanislaus': 'CCAA', 'California University of Pennsylvania': 'PSAC', 'Cameron': 'Lone Star',
  'Carson-Newman': 'SAC', 'Cedarville': 'GMAC', 'Central Washington': 'GNAC', 'Chaminade': 'PacWest',
  'Chestnut Hill': 'CACC', 'Chowan': 'Conference Carolinas', 'Christian Brothers': 'Gulf South', 'Claflin': 'Peach Belt',
  'Clarion': 'PSAC', 'Clark Atlanta': 'SIAC', 'Colorado Christian': 'RMAC', 'Colorado Mesa': 'RMAC',
  'Colorado School of Mines': 'RMAC', 'Colorado State – Pueblo': 'RMAC', 'Concord': 'MEC', 'Concordia – Irvine': 'PacWest',
  'Concordia, St. Paul': 'NSIC', 'D\'Youville': 'ECC', 'Davenport': 'GLIAC', 'Davis & Elkins': 'MEC',
  'Dominican – New York': 'CACC', 'Drury': 'GLVC', 'East Central': 'GAC', 'East Stroudsburg': 'PSAC',
  'Eastern New Mexico': 'Lone Star', 'Eckerd': 'Sunshine State', 'Edward Waters': 'SIAC', 'Embry-Riddle': 'Sunshine State',
  'Emmanuel': 'Conference Carolinas', 'Emory & Henry': 'SAC', 'Emporia State': 'MIAA', 'Erskine': 'Conference Carolinas',
  'Fairmont State': 'MEC', 'Felician': 'CACC', 'Flagler': 'Peach Belt', 'Florida Southern': 'Sunshine State',
  'Florida Tech': 'Sunshine State', 'Fort Hays State': 'MIAA', 'Franklin Pierce': 'NE10', 'Fresno Pacific': 'PacWest',
  'Frostburg State': 'MEC', 'Gannon': 'PSAC', 'Georgia Southwestern State': 'Peach Belt', 'Georgian Court': 'CACC',
  'Glenville State': 'MEC', 'Goldey-Beacom': 'CACC', 'Grand Valley State': 'GLIAC', 'Hawaii Pacific': 'PacWest',
  'Hillsdale': 'GMAC', 'Holy Family': 'CACC', 'Indiana University of Pennsylvania': 'PSAC', 'Kentucky State': 'SIAC',
  'Kentucky Wesleyan': 'GMAC', 'King': 'Conference Carolinas', 'Kutztown': 'PSAC', 'Lake Erie': 'GMAC',
  'Lander': 'Peach Belt', 'Lane': 'SIAC', 'LeMoyne-Owen': 'SIAC', 'Lewis': 'GLVC', 'Lincoln – Missouri': 'MIAA',
  'Lincoln University Pennsylvania': 'CIAA', 'Lock Haven': 'PSAC', 'Lubbock Christian': 'Lone Star',
  'Lynn': 'Sunshine State', 'Malone': 'GMAC', 'Mansfield': 'PSAC', 'Mars Hill': 'SAC', 'Maryville': 'GLVC', 'McKendree': 'GLVC',
  'Menlo': 'PacWest', 'Mercy': 'ECC', 'Metropolitan State': 'RMAC', 'Miles': 'SIAC', 'Millersville': 'PSAC',
  'Minnesota State – Mankato': 'NSIC', 'Minot State': 'NSIC', 'Missouri Southern State': 'MIAA',
  'Missouri University of Science & Technology': 'GLVC', 'Missouri Western State': 'MIAA', 'Molloy': 'ECC',
  'Montana State – Billings': 'GNAC', 'Morehouse': 'SIAC', 'New Mexico Highlands': 'RMAC', 'Newman': 'MIAA',
  'North Greenville': 'Conference Carolinas', 'Northeastern State': 'MIAA', 'Northern State': 'NSIC',
  'Northwest Missouri State': 'MIAA', 'Northwest Nazarene': 'GNAC', 'Northwestern Oklahoma State': 'GAC',
  'Northwood': 'GMAC', 'Ohio Dominican': 'GMAC', 'Oklahoma Baptist': 'GAC', 'Oklahoma Christian': 'Lone Star',
  'Pace': 'NE10', 'Pittsburg State': 'MIAA', 'Point Loma Nazarene': 'PacWest', 'Point Park': 'GMAC',
  'Post': 'CACC', 'Purdue – Northwest': 'GLIAC', 'Quincy': 'GLVC', 'Regis': 'RMAC', 'Rockhurst': 'GLVC',
  'Rogers State': 'MIAA', 'Roosevelt': 'GLIAC', 'Saginaw Valley State': 'GLIAC', 'Saint Anselm': 'NE10',
  'Saint Martin\'s': 'GNAC', 'Saint Michael\'s': 'NE10', 'Salem': 'Independent', 'San Francisco State': 'CCAA',
  'Savannah State': 'SIAC', 'Seton Hill': 'PSAC', 'Shepherd': 'PSAC', 'Shippensburg': 'PSAC',
  'Slippery Rock': 'PSAC', 'Sonoma State': 'CCAA', 'Southeastern Oklahoma State': 'GAC', 'Southern Connecticut State': 'NE10',
  'Southern Nazarene': 'GAC', 'Southern New Hampshire': 'NE10', 'Southern Wesleyan': 'Conference Carolinas',
  'Southwest Baptist': 'GLVC', 'Southwest Minnesota State': 'NSIC', 'Southwestern Oklahoma State': 'GAC',
  'Spring Hill': 'SIAC', 'St. Cloud State': 'NSIC', 'St. Edward\'s': 'Lone Star', 'St. Mary\'s – Texas': 'Lone Star',
  'St. Thomas Aquinas': 'ECC', 'Texas A&M International': 'Lone Star', 'Texas A&M – Kingsville': 'Lone Star',
  'The University of Virginia\'s College at Wise': 'SAC', 'Thomas Jefferson': 'CACC', 'Thomas More': 'GMAC',
  'Tiffin': 'GMAC', 'Trevecca Nazarene': 'GMAC', 'Truman State': 'GLVC', 'Tuskegee': 'SIAC', 'Union': 'Gulf South',
  'University of Bridgeport': 'CACC', 'University of Central Missouri': 'MIAA', 'University of Central Oklahoma': 'MIAA',
  'University of Charleston': 'MEC', 'University of Colorado – Colorado Springs': 'RMAC', 'University of Findlay': 'GMAC',
  'University of Hawaii at Hilo': 'PacWest', 'University of Illinois at Springfield': 'GLVC', 'University of Indianapolis': 'GLVC',
  'University of Jamestown': 'NSIC', 'University of Mary': 'NSIC', 'University of Minnesota – Crookston': 'NSIC',
  'University of Minnesota – Duluth': 'NSIC', 'University of Missouri – St. Louis': 'GLVC', 'University of Montevallo': 'Gulf South',
  'University of Mount Olive': 'Conference Carolinas', 'University of North Carolina at Pembroke': 'Conference Carolinas',
  'University of North Georgia': 'Peach Belt', 'University of Pittsburgh – Johnstown': 'PSAC', 'University of Sioux Falls': 'NSIC',
  'University of South Carolina – Beaufort': 'Peach Belt', 'University of South Carolina Aiken': 'Peach Belt',
  'University of Tampa': 'Sunshine State', 'University of Texas – Permian Basin': 'Lone Star', 'University of Texas – Tyler': 'Lone Star',
  'University of West Alabama': 'Gulf South', 'University of West Florida': 'Gulf South', 'University of Wisconsin – Parkside': 'GLIAC',
  'Upper Iowa': 'GLVC', 'Valdosta State': 'Gulf South', 'Virginia State': 'CIAA', 'Walsh': 'GMAC', 'Washburn': 'MIAA',
  'Wayne State College': 'NSIC', 'Wayne State University': 'GLIAC', 'West Chester': 'PSAC', 'West Liberty': 'MEC',
  'West Texas A&M': 'Lone Star', 'West Virginia State': 'MEC', 'West Virginia Wesleyan': 'MEC',
  'Western Oregon': 'GNAC', 'Westmont': 'PacWest', 'Wheeling': 'MEC', 'William Jessup': 'PacWest',
  'William Jewell': 'GLVC', 'Wilmington': 'CACC', 'Wingate': 'SAC', 'Winona State': 'NSIC', 'Young Harris': 'Peach Belt',
  'South Alabama': 'Sun Belt'
};

/**
 * Helper to retrieve conference for a university name.
 * Uses substring matching to handle variations like "University of Alabama" vs "Alabama".
 */
function getConference(university) {
  if (!university) return 'Other';
  
  // Try exact match first
  if (CONFERENCE_LOOKUP[university]) return CONFERENCE_LOOKUP[university];

  // Try substring match, prefer LONGER keys first to handle overlaps (e.g. "Alabama State" before "Alabama")
  const uniLower = university.toLowerCase();
  const sortedKeys = Object.keys(CONFERENCE_LOOKUP).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    const keyLower = key.toLowerCase();
    // Use word boundaries or just rely on length sorting for sub-matching
    if (uniLower.includes(keyLower)) {
      return CONFERENCE_LOOKUP[key];
    }
  }

  return 'Other';
}

module.exports = { CONFERENCE_LOOKUP, getConference };
