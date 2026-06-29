import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  isConnected,
  requestAccess,
  setAllowed,
  getAddress
} from "@stellar/freighter-api";
import { Horizon } from "@stellar/stellar-sdk";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const WalletContext = createContext(null);

function normalizeFreighterAddress(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return result.address || result.publicKey || "";
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Profile state (fetched from backend on wallet connect) ──
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Fetch profile from backend ──
  const fetchProfile = async (walletAddress) => {
    const target = walletAddress || address;
    if (!target) return null;

    try {
      setProfileLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/profile/${encodeURIComponent(target.trim().toUpperCase())}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (res.status === 404) {
        // Profile doesn't exist yet — that's fine, user needs to register
        setProfile(null);
        return null;
      }

      // Guard against HTML error pages (Cloudflare 5xx, Supabase down, etc.)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.warn("Profile fetch returned non-JSON (service may be down)");
        setProfile(null);
        return null;
      }

      if (!res.ok) {
        console.error("Failed to fetch profile:", res.statusText);
        setProfile(null);
        return null;
      }

      const data = await res.json();
      setProfile(data.profile || null);
      return data.profile || null;
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Update profile in state after saving (called from RolePage) ──
  const updateProfile = (newProfile) => {
    setProfile(newProfile);
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError("");

      await setAllowed();
      const connected = await isConnected();
      if (!connected.isConnected) {
        const access = await requestAccess();
        if (access.error) {
          throw new Error(access.error);
        }
      }

      const addressResult = await getAddress();
      if (addressResult.error) {
        throw new Error(addressResult.error);
      }

      const walletAddress = normalizeFreighterAddress(addressResult);
      if (!walletAddress) {
        throw new Error("Freighter did not return a wallet address");
      }
      setAddress(walletAddress);
      await fetchBalance(walletAddress);
      // Auto-fetch profile from backend on connect
      await fetchProfile(walletAddress);
    } catch (err) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (userAddress) => {
    const target = userAddress || address;
    if (!target) return;
    try {
      const server = new Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await server.loadAccount(target);
      const native = account.balances.find((b) => b.asset_type === "native");
      setBalance(native ? parseFloat(native.balance).toLocaleString() : "0");
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  };

  const disconnectWallet = () => {
    setAddress("");
    setBalance("0");
    setProfile(null);
  };

  // Derived role helpers
  const role = profile?.role || null;
  const hasProfile = Boolean(profile);

  const value = useMemo(
    () => ({
      address,
      balance,
      loading,
      error,
      connectWallet,
      disconnectWallet,
      fetchBalance,
      isConnected: Boolean(address),
      // Profile data
      profile,
      profileLoading,
      role,
      hasProfile,
      fetchProfile,
      updateProfile
    }),
    [address, balance, loading, error, profile, profileLoading]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return ctx;
}
