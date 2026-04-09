const ftp = require("basic-ftp");
const path = require("path");

async function deployDev() {
  const credsFile = path.join(__dirname, "../../.credentials/deploy_creds.json");
  const creds = JSON.parse(fs.readFileSync(credsFile, "utf8"));
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

    // Upload the primary dynamic index.html
    const indexHtml = path.join(__dirname, "../../index.html");
    console.log("Uploading index.html [dynamic] to DEV...");
    await client.uploadFrom(indexHtml, "index.html");
    
    await client.uploadFrom(path.join(__dirname, "../../favicon.png"), "favicon.png");

    // Upload static backup too
    const index1Html = path.join(__dirname, "../../index_1.html");
    if (fs.existsSync(index1Html)) {
      console.log("Uploading index_1.html [static backup] to DEV...");
      await client.uploadFrom(index1Html, "index_1.html");
    }

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
