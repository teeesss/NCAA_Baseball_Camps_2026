const fs = require('fs');
const path = require('path');
const { Client } = require('basic-ftp');

async function setupRedirect() {
    const client = new Client();
    client.ftp.verbose = true;

    // Create a local temp redirect file
    const tempDir = path.join(__dirname, '../../tmp_redirect');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const indexFile = path.join(tempDir, 'index.php');
    const content = `<?php
header("Location: https://www.bmwseals.com/Baseball_Camps_2026/", true, 301);
exit();
?>`;
    fs.writeFileSync(indexFile, content);

    try {
        await client.access({
            host: "67.205.7.13",
            user: "nughaud",
            password: "###",
            secure: false
        });

        console.log("Setting up short redirect at /bmwseals.com/bb2026");
        
        // Ensure the directory exists
        await client.ensureDir("/bmwseals.com/bb2026");
        
        // Upload the file
        await client.uploadFrom(indexFile, "index.php");
        
        console.log("Successfully created redirect at bmwseals.com/bb2026");

    } catch (err) {
        console.error("FTP Error:", err);
    } finally {
        client.close();
        // Clean up
        if (fs.existsSync(indexFile)) fs.unlinkSync(indexFile);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    }
}

setupRedirect();
