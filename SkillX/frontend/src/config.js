const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "");
export const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const STELLAR_EXPERT_NETWORK = import.meta.env.VITE_STELLAR_EXPERT_NETWORK || "testnet";
