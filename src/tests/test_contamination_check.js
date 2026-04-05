"use strict";

const assert = require("assert");
const { isContaminated } = require("../utils/contamination_check.js");

const allSchools = [
  "Alabama",
  "Alabama State",
  "Alabama A&M",
  "South Alabama",
  "Arkansas",
  "Arkansas State",
  "Arkansas-Pine Bluff",
  "Kansas",
  "Kansas State",
  "Michigan",
  "Michigan State",
  "Central Michigan",
  "Eastern Michigan",
  "Western Michigan",
];

function runTests() {
  console.log("🏃 Running contamination check tests...");

  // 1. Target = Alabama, Text = "Welcome to Alabama State Baseball Camp"
  // Should be CONTAMINATED (match is for Alabama State, not Alabama)
  assert.strictEqual(
    isContaminated(
      "Welcome to Alabama State Baseball Camp",
      "Alabama",
      allSchools,
    ),
    true,
    "Alabama should be contaminated by Alabama State",
  );

  // 2. Target = Alabama State, Text = "Welcome to Alabama State Baseball Camp"
  // Should NOT be contaminated (it perfectly matches)
  assert.strictEqual(
    isContaminated(
      "Welcome to Alabama State Baseball Camp",
      "Alabama State",
      allSchools,
    ),
    false,
    "Alabama State should not be contaminated by itself",
  );

  // 3. Target = Kansas, Text = "Arkansas Baseball Showcase"
  // Should be CONTAMINATED (Arkansas contains Kansas)
  assert.strictEqual(
    isContaminated("Arkansas Baseball Showcase", "Kansas", allSchools),
    true,
    "Kansas should be contaminated by Arkansas",
  );

  // 4. Target = Arkansas, Text = "Arkansas Baseball Showcase"
  // Should NOT be contaminated (Arkansas is the actual target)
  assert.strictEqual(
    isContaminated("Arkansas Baseball Showcase", "Arkansas", allSchools),
    false,
    "Arkansas should not be contaminated by itself",
  );

  // 5. Target = Michigan, Text = "Eastern Michigan eagles camp"
  assert.strictEqual(
    isContaminated("Eastern Michigan eagles camp", "Michigan", allSchools),
    true,
    "Michigan should be contaminated by Eastern Michigan",
  );

  // 6. Target = Michigan, Text = "Michigan summer baseball camp"
  assert.strictEqual(
    isContaminated("Michigan summer baseball camp", "Michigan", allSchools),
    false,
    "Michigan should not be contaminated on valid text",
  );

  console.log("✅ All contamination tests passed!");
}

runTests();
