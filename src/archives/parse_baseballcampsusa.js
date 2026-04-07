const fs = require("fs");
const path = require("path");
const html = fs.readFileSync("baseballcampsusa_root.html", "utf8");

const regex =
  /<span class="school">([^<]+)<\/span>[\s\S]*?<a href="([^"]+)" class="viewSite"/g;
let match;
const results = [];

while ((match = regex.exec(html)) !== null) {
  results.push({
    school: match[1].trim(),
    url: match[2].trim(),
  });
}

fs.writeFileSync(
  "baseballcampsusa_parsed.json",
  JSON.stringify(results, null, 2),
);
console.log(`Extracted ${results.length} school links.`);
