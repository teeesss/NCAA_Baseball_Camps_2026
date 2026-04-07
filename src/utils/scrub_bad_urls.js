const fs = require("fs");
const path = require("path");
const { validateUrl } = require("./url_validator");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

let fixes = 0;

data.forEach((s) => {
  if (!s.campUrl) return;
  const result = validateUrl(s.campUrl, s.university);
  if (!result.passed) {
    console.log(
      `[${fixes + 1}] Scrubbing ${s.university}: ${s.campUrl} (Reason: ${result.reason})`,
    );
    s.campUrl = "";
    s.auditStatus = "URL_MISMATCH"; // Signal for re-extraction
    s.isChecked = false;
    s.isVerified = false;
    fixes++;
  } else if (result.url && result.url !== s.campUrl) {
    console.log(
      `[${fixes + 1}] Unwrapping ${s.university}: ${s.campUrl} -> ${result.url}`,
    );
    s.campUrl = result.url;
    fixes++;
  }
});

fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

console.log(`\n✅ Cleaned/Unwrapped ${fixes} URLs`);
