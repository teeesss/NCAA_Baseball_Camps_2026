const { runExtraction } = require("../utils/extraction_engine");

async function test() {
  await runExtraction({
    schoolFilter: "Alabama,Alcorn State", // Alabama has verified URL, Alcorn State is in lost tiers
    forceRequeue: true
  });
}

test();
