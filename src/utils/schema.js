"use strict";

const { PRICE_THRESHOLDS } = require("./config");

// Defines the "recheck" object structure that allows targeted granular extraction.
const DEFAULT_RECHECK_FLAGS = {
  email: false,
  poc: false,
  campDates: false,
  cost: false,
  campDetails: false,
  url: false
};

/**
 * Ensures a school object has the proper recheck schema initialized.
 */
function initializeRecheckSchema(school) {
  if (!school.recheck || typeof school.recheck !== "object") {
    school.recheck = { ...DEFAULT_RECHECK_FLAGS };
  } else {
    // Ensure all keys exist
    for (const key in DEFAULT_RECHECK_FLAGS) {
      if (school.recheck[key] === undefined) {
        school.recheck[key] = DEFAULT_RECHECK_FLAGS[key];
      }
    }
  }
  return school;
}

/**
 * Determines if a specific chunk of the extraction engine should run 
 * based on the recheck flags, OR if it's a full run.
 * If ALL flags are false (or missing), it's a full run (meaning everything runs).
 */
function shouldExtractField(school, fieldName) {
  if (!school.recheck || typeof school.recheck !== "object") return true; // Full run

  // Check if any flag is true
  const isTargetedRun = Object.values(school.recheck).some(val => val === true);
  
  if (!isTargetedRun) return true; // Full run

  // Targeted run: only run if this specific field is flagged
  return school.recheck[fieldName] === true;
}

/**
 * Resets a specific recheck flag to false (called after successful targeted extraction).
 */
function clearRecheckFlag(school, fieldName) {
  if (school.recheck && typeof school.recheck === "object") {
    school.recheck[fieldName] = false;
  }
}

/**
 * Returns true if the school requires a full run (no targeted flags are true).
 */
function isFullExtractionRun(school) {
  if (!school.recheck || typeof school.recheck !== "object") return true;
  return !Object.values(school.recheck).some(val => val === true);
}

module.exports = {
  DEFAULT_RECHECK_FLAGS,
  initializeRecheckSchema,
  shouldExtractField,
  clearRecheckFlag,
  isFullExtractionRun
};
