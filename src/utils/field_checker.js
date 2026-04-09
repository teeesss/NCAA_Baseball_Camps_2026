"use strict";

const { PRICE_THRESHOLDS, EMAIL_PATTERN } = require("./config");
const { initializeRecheckSchema } = require("./schema");

/**
 * Checks if a school lacks a collegiate email address, 
 * returning true if the email is empty or seems invalid/generic.
 */
function isEmailMissingOrJunk(school) {
  const email = school.campPOCEmail || school.email || "";
  if (!email || email.trim() === "TBA" || email.trim() === "") return true;
  // Further validation can hook into blacklists if needed.
  return false;
}

/**
 * Checks if cost is missing or flagged as TBA.
 */
function isCostMissing(school) {
  const cost = school.cost || "";
  return cost === "TBA" || cost.trim() === "";
}

/**
 * Checks if the cost is suspiciously low based on config.
 */
function isCostSuspicious(school) {
  const cost = school.cost || "";
  if (cost === "TBA" || cost.trim() === "") return false;

  let prices = (cost.match(/\$[\d,]+(?:\.\d{2})?/g) || []).map((p) => parseFloat(p.replace(/[\$,]/g, "")));
  if (prices.length === 0) {
      // try bare numbers
      prices = (cost.match(/\b\d[,.\d]*/) || []).map((p) => parseFloat(p.replace(/[\$,]/g, "")));
  }

  if (prices.length > 0) {
    const minPrice = Math.min(...prices.filter(p => !isNaN(p)));
    if (minPrice < PRICE_THRESHOLDS.VERIFY_MANUALLY) return true;
  }
  return false;
}

/**
 * Checks if camp dates are missing.
 */
function isDateMissing(school) {
  const dates = school.dates || school.campDates || "";
  return dates === "TBA" || dates.trim() === "";
}

/**
 * Analyzes a school record and updates its `recheck` flags, returning the updated school.
 */
function applyCompletenessFlags(school) {
  school = initializeRecheckSchema(school);
  
  if (isEmailMissingOrJunk(school)) {
    school.recheck.email = true;
  }
  
  if (isCostMissing(school) || isCostSuspicious(school)) {
    // If we have a verified URL, we can recheck the cost/dates.
    if (school.campUrl && school.campUrl !== "TBA" && school.campUrl !== "") {
        school.recheck.cost = true;
    }
  }

  if (isDateMissing(school)) {
    if (school.campUrl && school.campUrl !== "TBA" && school.campUrl !== "") {
        school.recheck.campDates = true;
    }
  }

  return school;
}

module.exports = {
  isEmailMissingOrJunk,
  isCostMissing,
  isCostSuspicious,
  isDateMissing,
  applyCompletenessFlags
};
