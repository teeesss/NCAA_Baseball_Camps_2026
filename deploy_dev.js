const ftp = require("basic-ftp");
const fs = require("fs");

async function deployDev() {
  const creds = JSON.parse(
    fs.readFileSync(".credentials/deploy_creds.json", "utf8"),
  );
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: creds.host,
      user: creds.user,
      password: creds.password,
      secure: creds.secure,
    });

    const targetDir = "/bmwseals.com/Baseball_Camps_2026_dev";

    console.log(`Ensuring isolated DEV directory exists: ${targetDir}`);
    await client.ensureDir(targetDir);
    console.log("DEV path confirmed:", targetDir);

    // Only upload dev-specific files. Dev reads camps_data.json, verify_human.php,
    // and human_verifications.json from the production directory via relative paths.
    console.log("Uploading dev-specific assets to DEV...");
    await client.uploadFrom("index_dev.html", "index.html");
    await client.uploadFrom("favicon.png", "favicon.png");

    // Final verification
    const remoteList = await client.list(".");
    const remoteIndex = remoteList.find((f) => f.name === "index.html");
    if (remoteIndex) {
      console.log(
        `VERIFIED: Remote index.html exists, size: ${remoteIndex.size} bytes`,
      );
    } else {
      console.error("CRITICAL: Remote index.html NOT FOUND after upload!");
    }

    console.log("\nDEV Deployment Successful!");
    console.log(`URL: https://bmwseals.com/Baseball_Camps_2026_dev/`);
    console.log(
      "Dev site references production for: camps_data.json, verify_human.php, human_verifications.json",
    );
  } catch (err) {
    console.error("DEV Deployment failed:", err);
  }
  client.close();
}

deployDev();
