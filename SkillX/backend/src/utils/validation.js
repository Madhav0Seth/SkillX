const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isWalletAddress(value) {
  return STELLAR_PUBLIC_KEY.test(value);
}

function requiredText(value, field, { min = 1, max = 5000 } = {}) {
  if (typeof value !== "string") return `${field} must be a string`;
  const text = value.trim();
  if (text.length < min || text.length > max) {
    return `${field} must be between ${min} and ${max} characters`;
  }
  return null;
}

function positiveId(value, field = "id") {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function pageLimit(value, defaultLimit = 50, maxLimit = 100) {
  if (value === undefined) return defaultLimit;
  const limit = positiveId(value, "limit");
  return limit && limit <= maxLimit ? limit : null;
}

function normalizeHttpUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".")
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function validateUrl(value, field) {
  const textError = requiredText(value, field, { max: 2048 });
  if (textError) return textError;
  return normalizeHttpUrl(value) ? null : `${field} must be a valid domain or HTTP(S) URL`;
}

function normalizeSkills(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 30) return null;
  const normalized = value.map((skill) => typeof skill === "string" ? skill.trim().toLowerCase() : "");
  if (normalized.some((skill) => !skill || skill.length > 80)) return null;
  return [...new Set(normalized)];
}

function validateMilestones(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 25) {
    return "milestones must contain between 1 and 25 items";
  }

  let totalPercentage = 0;
  for (const milestone of value) {
    if (!milestone || typeof milestone !== "object") return "Each milestone must be an object";
    const nameError = requiredText(milestone.name, "milestone name", { min: 1, max: 160 });
    if (nameError) return nameError;
    const percentage = Number(milestone.percentage);
    const amount = Number(milestone.amount);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return "Each milestone percentage must be greater than 0 and at most 100";
    }
    if (!Number.isFinite(amount) || amount < 0) return "Each milestone amount must be a non-negative number";
    if (!milestone.deadline || Number.isNaN(Date.parse(milestone.deadline))) {
      return "Each milestone deadline must be a valid date";
    }
    totalPercentage += percentage;
  }
  return Math.abs(totalPercentage - 100) < 0.00001
    ? null
    : "Milestone percentages must total 100";
}

module.exports = {
  isWalletAddress,
  normalizeHttpUrl,
  normalizeWallet,
  pageLimit,
  positiveId,
  requiredText,
  normalizeSkills,
  validateMilestones,
  validateUrl,
};
