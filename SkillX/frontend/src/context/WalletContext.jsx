import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  isConnected,
  requestAccess,
  setAllowed,
  getAddress
} from "@stellar/freighter-api";
import { Horizon } from "@stellar/stellar-sdk";
import { api } from "../services/api";
import { HORIZON_URL } from "../config";
import { normalizeWallet } from "../utils/wallet";

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

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = async (walletAddress) => {
    const target = normalizeWallet(walletAddress || address);
    if (!target) return null;
    try {
      setProfileLoading(true);
      const data = await api.getProfile(target);
      setProfile(data.profile || null);
      return data.profile || null;
    } catch {
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
      const server = new Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(target);
      const native = account.balances.find((b) => b.asset_type === "native");
      setBalance(native ? parseFloat(native.balance).toLocaleString() : "0");
    } catch {
      setBalance("0");
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
