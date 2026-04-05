const fs = require("fs");
const d = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));

// ─── Florida ───
const fl = d.find((r) => r.university === "Florida");
fl.cost = "$1,350";
fl.campTiers = [
  { name: "Youth Summer Camp", dates: "July 7-10, 2026", cost: "TBA" },
  { name: "Middle School Camp", dates: "July 14-16, 2026", cost: "TBA" },
  { name: "7th-8th Grade Experience", dates: "July 21-23, 2026", cost: "TBA" },
  { name: "HS Experience Camp", dates: "July 28-31, 2026", cost: "$1,350" },
];
console.log("FL fixed:", fl.cost);

// ─── Gonzaga ───
const gz = d.find((r) => r.university === "Gonzaga");
gz.cost = "$125";
gz.campTiers = [
  { name: "Helena Future Zags", dates: "June 22-23, 2026", cost: "$125" },
  { name: "Pups Camp (Ages 4-6)", dates: "July 1-2, 2026", cost: "$50" },
  { name: "Lil Zags (Ages 6-10)", dates: "July 1-2, 2026", cost: "$125" },
  { name: "Big Dogs (Ages 10-14)", dates: "July 7-8, 2026", cost: "$140" },
];
console.log("GZ fixed:", gz.cost);

fs.writeFileSync("camps_data.json", JSON.stringify(d, null, 2));
console.log("Saved.");
