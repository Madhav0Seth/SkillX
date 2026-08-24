export function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function shortWallet(value, start = 6, end = 4) {
  const wallet = normalizeWallet(value);
  return wallet ? `${wallet.slice(0, start)}…${wallet.slice(-end)}` : "Unknown wallet";
}

export function normalizeHttpUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    return ["https:", "http:"].includes(url.protocol) && url.hostname.includes(".")
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function isHttpUrl(value) {
  return Boolean(normalizeHttpUrl(value));
}
