/**
 * SYNC HUMAN VERIFICATIONS
 * Fetches the 'human_verifications.json' file from the live server.
 * This ensures the crowdsourced 'verification counts' are reflected in the nightly update.
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const REMOTE_URL =
  "https://bmwseals.com/Baseball_Camps_2026/human_verifications.json";
const LOCAL_FILE = path.join(__dirname, "../../human_verifications.json");

async function fetch() {
  console.log(`[SYNC] Fetching community verifications from live server...`);
  try {
    const resp = await axios.get(REMOTE_URL, { timeout: 10000 });
    if (resp.data) {
      fs.writeFileSync(LOCAL_FILE, JSON.stringify(resp.data, null, 2));
      console.log(
        `[SYNC] Success! Community verification counts updated locally.`,
      );
    }
  } catch (e) {
    console.error(
      `[SYNC] Error fetching verifications: ${e.message}. Using existing local copy if any.`,
    );
  }
}

fetch();
