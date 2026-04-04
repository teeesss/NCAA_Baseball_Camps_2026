const ftp = require("basic-ftp");
const fs = require("fs");

async function deployDev() {
    const creds = JSON.parse(fs.readFileSync('.credentials/deploy_creds.json', 'utf8'));
    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
        await client.access({
            host: creds.host,
            user: creds.user,
            password: creds.password,
            secure: creds.secure
        });

        // Isolated DEV directory for testing the 35KB high-performance architecture
        const targetDir = "/bmwseals.com/Baseball_Camps_2026_dev";
        
        console.log(`Ensuring isolated DEV directory exists: ${targetDir}`);
        await client.ensureDir(targetDir);

        console.log("DEV path confirmed:", targetDir);
        
        // Upload the dynamic rendering dev version
        console.log("Uploading dynamic assets to DEV...");
        await client.uploadFrom("index_dev.html", "index.html");
        await client.uploadFrom("camps_data.json", "camps_data.json");
        await client.uploadFrom("verify_human.php", "verify_human.php");

        console.log("Uploading favicon.png...");
        await client.uploadFrom("favicon.png", "favicon.png");

        // Final verification
        const remoteList = await client.list(".");
        const remoteIndex = remoteList.find(f => f.name === 'index.html');
        if (remoteIndex) {
            console.log(`VERIFIED: Remote index.html exists, size: ${remoteIndex.size} bytes`);
        } else {
            console.error("CRITICAL: Remote index.html NOT FOUND after upload!");
        }

        console.log("DEV Deployment Successful!");
        console.log(`URL: https://bmwseals.com/Baseball_Camps_2026_dev/`);
    }
    catch (err) {
        console.error("DEV Deployment failed:", err);
    }
    client.close();
}

deployDev();
