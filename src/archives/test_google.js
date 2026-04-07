const googleIt = require("google-it");

async function test() {
  try {
    console.log("Searching Google...");
    const results = await googleIt({
      query: "Arkansas Razorbacks baseball camp 2026",
    });
    console.log(`Found ${results.length} results:`);
    results.slice(0, 3).forEach((r) => console.log(`- ${r.link}`));
  } catch (e) {
    console.error("Google Error:", e.message);
  }
}

test();
