export function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function shortWallet(value, start = 6, end = 4) {
  const wallet = normalizeWallet(value);
  return wallet ? `${wallet.slice(0, start)}…${wallet.slice(-end)}` : "Unknown wallet";
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
