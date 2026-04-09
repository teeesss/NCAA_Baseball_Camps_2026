
const campTiers = [
    { name: "Welcome and thank you for visiting the Northwestern University Baseball Camp", dates: "TBA", cost: "TBA" },
    { name: "Wildcat Youth Experience Camp", dates: "June 22", cost: "$427.00" }
];

console.log("Before Sorting:", campTiers);

const dedupeSorted = campTiers.sort((a, b) => {
    const aHasCost = a.cost && a.cost !== "TBA";
    const bHasCost = b.cost && b.cost !== "TBA";
    if (aHasCost && !bHasCost) return -1;
    if (!aHasCost && bHasCost) return 1;
    return 0;
});

console.log("After Sorting (Prioritize Cost):", dedupeSorted);

const seen = new Set();
const filtered = dedupeSorted.filter((t) => {
    const firstDate = (t.dates.split(",")[0] || "").trim().toLowerCase().replace(/st|nd|rd|th/g, "");
    const key = t.name.toLowerCase().substring(0, 30) + "::" + firstDate;
    console.log(`Checking key: ${key}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

console.log("Final Filtered:", filtered);
