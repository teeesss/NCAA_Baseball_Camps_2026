const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../camps_data.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const VALID_MONTH_REGEX =
  /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|0[1-9]\/|1[02]\//i;
const SUMMER_MONTH_REGEX = /Jun|Jul|Aug|June|July|August|0[678]\/|[678]\//i;
const YEAR_REGEX = /202[456789]/i;

function reconcile() {
  let modifiedCount = 0;

  data.forEach((item) => {
    let needsUpdate = false;
    let allValidSessions = [];

    // 1. Gather all sessions from campTiers
    if (item.campTiers && Array.isArray(item.campTiers)) {
      item.campTiers.forEach((tier) => {
        const processDates = (dateInput) => {
          if (!dateInput) return;

          // Handle arrays, single strings, or comma-separated strings
          const dateStrings = Array.isArray(dateInput)
            ? dateInput
            : String(dateInput).split(/[,|]/);

          dateStrings.forEach((rawDate) => {
            const dateStr = rawDate.trim();
            if (!dateStr) return;

            // Check if it's a numeric date like 8/20
            const isSummer = SUMMER_MONTH_REGEX.test(dateStr);
            const hasYear = YEAR_REGEX.test(dateStr);

            // We only promote SUMMER 2026 dates to the top level
            if (isSummer) {
              let finalDate = dateStr;
              if (!hasYear) {
                // If it's a simple 8/20, we don't want to just append , 2026 if it looks weird
                // But for consistency in summary, we'll format it
                if (/^\d{1,2}\/\d{1,2}$/.test(dateStr)) {
                  const [m, d] = dateStr.split("/");
                  const monthNames = [
                    "",
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "June",
                    "July",
                    "August",
                    "Sept",
                    "Oct",
                    "Nov",
                    "Dec",
                  ];
                  finalDate = `${monthNames[parseInt(m)]} ${d}, 2026`;
                } else {
                  finalDate += ", 2026";
                }
              }
              allValidSessions.push(finalDate);
            }
          });
        };

        if (tier.sessions && Array.isArray(tier.sessions)) {
          tier.sessions.forEach((session) => processDates(session.dates));
        } else {
          processDates(tier.dates);
        }
      });
    }

    // 2. Synchronize Dates
    if (allValidSessions.length > 0) {
      // Deduplicate and format
      const uniqueDates = [...new Set(allValidSessions.map((d) => d.trim()))];
      const newDatesString =
        uniqueDates.slice(0, 3).join(" | ") +
        (uniqueDates.length > 3 ? "..." : "");

      if (item.dates === "TBA" || item.dates !== newDatesString) {
        // Check if current dates are invalid (e.g. November or old string)
        const isCurrentDateInvalid =
          item.dates !== "TBA" && !SUMMER_MONTH_REGEX.test(item.dates);
        if (
          item.dates === "TBA" ||
          isCurrentDateInvalid ||
          item.dates !== newDatesString
        ) {
          console.log(
            `[${item.university}] Updating dates: ${item.dates} -> ${newDatesString}`,
          );
          item.dates = newDatesString;
          needsUpdate = true;
        }
      }
    } else if (item.dates !== "TBA" && !SUMMER_MONTH_REGEX.test(item.dates)) {
      // No valid sessions in tiers, and top-level date is invalid (e.g. November)
      console.log(
        `[${item.university}] Resetting invalid top-level dates: ${item.dates} -> TBA`,
      );
      item.dates = "TBA";
      needsUpdate = true;
    }

    // 3. Synchronize Cost
    const tierCosts = (item.campTiers || [])
      .map((t) => t.cost)
      .filter((c) => c && c !== "TBA" && c.includes("$"))
      .map((c) => {
        // Normalize: Remove commas and treat as basic number
        // For $1,00 (scraped typo), convert to 100
        // For $1.00 (scraped trash), convert to 1
        const cleanValue = c.replace(/,/g, "").match(/\$(\d+(?:\.\d{2})?)/);
        return cleanValue ? parseFloat(cleanValue[1]) : null;
      })
      .filter((n) => n !== null && n >= 50 && n <= 1500); // Only promote realistic camp costs ($50-$1500)

    if (tierCosts.length > 0) {
      const minCost = Math.min(...tierCosts);
      const newCostString = `$${minCost}.00+`;

      // Reconcile if TBA OR if current cost is suspiciously low/mismatched
      const currentPrice = item.cost
        ? parseFloat(
            (item.cost.match(/\d[\d,.]*/) || ["0"])[0].replace(/,/g, ""),
          )
        : 0;

      if (
        item.cost === "TBA" ||
        currentPrice < 50 ||
        item.cost !== newCostString
      ) {
        console.log(
          `[${item.university}] Updating cost: ${item.cost} -> ${newCostString}`,
        );
        item.cost = newCostString;
        needsUpdate = true;
      }
    }

    if (needsUpdate) modifiedCount++;
  });

  if (modifiedCount > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`\n✅ Reconciled ${modifiedCount} records.`);
  } else {
    console.log("\n✅ Data is already synchronized.");
  }
}

reconcile();
