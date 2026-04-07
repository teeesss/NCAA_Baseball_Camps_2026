const fs = require("fs");
const data = JSON.parse(fs.readFileSync("camps_data.json", "utf8"));
const suspicious = [];
data.forEach((s) => {
  if (s.campTiers) {
    s.campTiers.forEach((t) => {
      const costStr = t.cost || "";
      const nums = costStr.match(/\$?\d+/g);
      if (nums) {
        nums.forEach((n) => {
          const val = parseInt(n.replace("$", "").replace(",", ""));
          if (!isNaN(val) && val >= 0 && val < 10) {
            suspicious.push({
              school: s.university,
              tier: t.name,
              cost: t.cost,
              url: s.campUrl,
            });
          }
        });
      }
    });
  }
  if (s.cost) {
    const nums = s.cost.match(/\$?\d+/g);
    if (nums) {
      nums.forEach((n) => {
        const val = parseInt(n.replace("$", "").replace(",", ""));
        if (!isNaN(val) && val >= 0 && val < 10) {
          suspicious.push({
            school: s.university,
            tier: "top-level",
            cost: s.cost,
            url: s.campUrl,
          });
        }
      });
    }
  }
});
console.log("Found " + suspicious.length + " suspicious low-price entries:");
suspicious.forEach((s) => console.log(JSON.stringify(s)));
