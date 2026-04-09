const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");

async function deploy() {
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

    // The target directory path is now pulled from the .credentials JSON configuration file
    const targetDir = creds.remotePath || "/bmwseals.com/Baseball_Camps_2026";

    console.log(`Ensuring remote directory exists: ${targetDir}`);
    await client.ensureDir(targetDir);

    console.log("Remote path confirmed:", targetDir);

    const indexHtml = path.join(__dirname, "../../index.html");
    const localSize = fs.statSync(indexHtml).size;
    console.log(`Uploading index.html [dynamic] (${localSize} bytes)...`);
    await client.uploadFrom(indexHtml, "index.html");

    console.log("Uploading camps_data.json...");
    await client.uploadFrom(path.join(__dirname, "../../camps_data.json"), "camps_data.json");

    console.log("Uploading favicon.png...");
    await client.uploadFrom(path.join(__dirname, "../../favicon.png"), "favicon.png");

    // Final Verification
    const remoteList = await client.list(".");
    const remoteIndex = remoteList.find((f) => f.name === "index.html");
    if (remoteIndex) {
      console.log(
        `VERIFIED: Remote index.html exists, size: ${remoteIndex.size} bytes`,
      );
    } else {
      console.error("CRITICAL: Remote index.html NOT FOUND after upload!");
    }

    await client.uploadFrom(path.join(__dirname, "../../verify_human.php"), "verify_human.php");

    // [PROTECTED] Do NOT upload human_verifications.json here as it would overwrite the
    // production server's live data. We sync DOWN instead.

    const docxFile = path.join(__dirname, "../../NCAA-Baseball-Camps-2026.docx");
    console.log(`Uploading ${path.basename(docxFile)}...`);
    await client.uploadFrom(docxFile, path.basename(docxFile));

    console.log("Deployment Successful!");
  } catch (err) {
    console.error("Deployment failed:", err);
  }
  client.close();
}

deploy();
