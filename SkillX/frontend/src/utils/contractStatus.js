const MILESTONE_STATUS = ["pending", "submitted", "approved", "paid"];
const JOB_STATUS = ["open", "inprogress", "completed", "cancelled"];

function enumLabel(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.length === 1 ? enumLabel(value[0]) : "";
  }
  if (typeof value === "object") {
    if (typeof value.name === "string") return value.name;
    if (typeof value.variant === "string") return value.variant;
    if (typeof value.tag === "string") return value.tag;
    const keys = Object.keys(value);
    if (keys.length === 1) return keys[0];
  }
  return String(value);
}

function normalizeEnumStatus(value, labels) {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "bigint" ? Number(value) : value;

  if (typeof raw === "number" && Number.isInteger(raw)) {
    return labels[raw] || "";
  }

  const label = enumLabel(raw).trim().toLowerCase();
  if (/^\d+$/.test(label)) {
    return labels[Number(label)] || "";
  }
  return label;
}

export function getMilestoneStatus(milestone) {
  return normalizeEnumStatus(milestone?.status, MILESTONE_STATUS);
}

export function getJobStatus(status) {
  return normalizeEnumStatus(status, JOB_STATUS);
}
