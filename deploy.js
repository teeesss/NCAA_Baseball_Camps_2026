const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");

async function deploy() {
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

        // The user specified url: https://bmwseals.com/Baseball_Camps_2026/
        const targetDir = "/bmwseals.com/Baseball_Camps_2026";
        
        console.log(`Ensuring remote directory exists: ${targetDir}`);
        await client.ensureDir(targetDir);

        console.log("Remote path confirmed:", targetDir);
        
        const localSize = fs.statSync("index.html").size;
        console.log(`Uploading index.html (${localSize} bytes)...`);
        await client.uploadFrom("index.html", "index.html");
        
        // Final Verification
        const remoteList = await client.list(".");
        const remoteIndex = remoteList.find(f => f.name === 'index.html');
        if (remoteIndex) {
            console.log(`VERIFIED: Remote index.html exists, size: ${remoteIndex.size} bytes`);
        } else {
            console.error("CRITICAL: Remote index.html NOT FOUND after upload!");
        }

        console.log("Uploading Verification Files...");
        await client.uploadFrom("verify_human.php", "verify_human.php");
        
        if (fs.existsSync("human_verifications.json")) {
            await client.uploadFrom("human_verifications.json", "human_verifications.json");
        }
        if (fs.existsSync("human_verifications_ip.json")) {
            await client.uploadFrom("human_verifications_ip.json", "human_verifications_ip.json");
        }

        console.log("Uploading NCAA-Baseball-Camps-2026.docx...");
        await client.uploadFrom("NCAA-Baseball-Camps-2026.docx", "NCAA-Baseball-Camps-2026.docx");

        console.log("Deployment Successful!");
    }
    catch (err) {
        console.error("Deployment failed:", err);
    }
    client.close();
}

deploy();
