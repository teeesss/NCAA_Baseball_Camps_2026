const fs = require('fs');
const path = require('path');

const DATA_PATH = 'camps_data.json';

function applyUpdates() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  let updatedCount = 0;

  const updates = [
    {
      university: 'Ball State',
      updates: {
        campUrl: 'https://ballstatebaseballcamps.totalcamps.com/',
        dates: 'Summer 2026',
        cost: '$150 - $450 (Varies)',
        details: 'Rich Maloney Baseball Camps at Ball State University. Prospect & Youth options.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    },
    {
      university: 'BYU',
      updates: {
        campUrl: 'https://www.byusportscamps.com/baseball',
        dates: 'June/July 2026',
        cost: 'See Registration site (Approx $469)',
        details: 'Baseball Skills Camp & High School Prospect Camps.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        logoDomain: 'byucougars.com',
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    },
    {
      university: 'Cal State Fullerton',
      updates: {
        campUrl: 'https://info.collegebaseballcamps.com/csf-baseball/',
        dates: '06/29/2026 - 07/30/2026',
        cost: '$375.00',
        details: 'Titan Baseball Camps. Multiple weeks of Summer Youth Camp.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    },
    {
      university: 'Central Michigan',
      updates: {
        campUrl: 'https://cmubaseballcamps.totalcamps.com/',
        dates: 'Summer 2026',
        cost: 'Varies',
        details: 'CMU Baseball Camps. Prospect ID Camps & Youth Tiers.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    },
    {
      university: 'Charlotte',
      updates: {
        campUrl: 'https://www.playnsports.com/organization/robert-woodard-baseball-camps/',
        dates: 'Summer 2026',
        cost: 'See Site',
        details: 'UNC Charlotte 49ers official Robert Woodard Baseball Camps. Prospect camps focus on individual development.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        logoDomain: 'charlotte49ers.com',
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    },
    {
      university: 'Coastal Carolina',
      updates: {
        campUrl: 'https://www.ccubaseballcamps.com/',
        dates: 'Summer 2026',
        cost: 'See Site',
        details: 'CCU Baseball Camps at Gary Gilmore Field.',
        isVerified: true,
        isChecked: true,
        scriptVersion: 6,
        logoDomain: 'goccusports.com',
        isHumanVerified: true,
        verificationStatus: 'User Provided'
      }
    }
  ];

  updates.forEach(upd => {
    const idx = data.findIndex(s => s.university.toLowerCase() === upd.university.toLowerCase());
    if (idx !== -1) {
      data[idx] = { ...data[idx], ...upd.updates };
      console.log(`Updated ${upd.university}`);
      updatedCount++;
    } else {
      console.warn(`Target ${upd.university} not found!`);
    }
  });

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`Success! Updated ${updatedCount} schools.`);
}

applyUpdates();
