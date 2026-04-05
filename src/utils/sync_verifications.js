const { Client } = require("basic-ftp");
const fs = require("fs");
const path = require("path");

async function sync() {
  const creds = JSON.parse(
    fs.readFileSync(".credentials/deploy_creds.json", "utf8"),
  );
  const client = new Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: creds.host,
      user: creds.user,
      password: creds.password,
      secure: creds.secure,
    });

    const targetDir = "/bmwseals.com/Baseball_Camps_2026";
    await client.cd(targetDir);

    console.log("⬇️ Downloading Community Verification data from server...");

    await client.downloadTo(
      "human_verifications.json",
      "human_verifications.json",
    );
    await client.downloadTo(
      "human_verifications_ip.json",
      "human_verifications_ip.json",
    );

    console.log("✅ Successfully synced verification data to local workspace.");

    // Now, update camps_data.json with these counts (optional but good for master record)
    const verifications = JSON.parse(
      fs.readFileSync("human_verifications.json", "utf8"),
    );
    const dataPath = "camps_data.json";
    const campsData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    let updatedCount = 0;
    campsData.forEach((camp) => {
      if (verifications[camp.university]) {
        camp.humanVerifiedCount = verifications[camp.university];
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      fs.writeFileSync(dataPath, JSON.stringify(campsData, null, 2));
      console.log(
        `📊 Integrated ${updatedCount} community verifications into master dataset.`,
      );
    }
  } catch (err) {
    console.error("❌ Sync failed:", err);
  } finally {
    client.close();
  }
}

sync();
