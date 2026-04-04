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

        // The target directory path is now pulled from the .credentials JSON configuration file
        const targetDir = creds.remotePath || "/bmwseals.com/Baseball_Camps_2026";
        
        console.log(`Ensuring remote directory exists: ${targetDir}`);
        await client.ensureDir(targetDir);

        console.log("Remote path confirmed:", targetDir);
        
        const localSize = fs.statSync("index.html").size;
        console.log(`Uploading index.html (${localSize} bytes)...`);
        await client.uploadFrom("index.html", "index.html");
        
        console.log("Uploading camps_data.json...");
        await client.uploadFrom("camps_data.json", "camps_data.json");
        
        // Final Verification
        const remoteList = await client.list(".");
        const remoteIndex = remoteList.find(f => f.name === 'index.html');
        if (remoteIndex) {
            console.log(`VERIFIED: Remote index.html exists, size: ${remoteIndex.size} bytes`);
        } else {
            console.error("CRITICAL: Remote index.html NOT FOUND after upload!");
        }

        await client.uploadFrom("verify_human.php", "verify_human.php");
        
        // [PROTECTED] Do NOT upload human_verifications.json here as it would overwrite the 
        // production server's live data. We sync DOWN instead.


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
