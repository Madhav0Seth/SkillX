import { createContext, useContext, useMemo, useState } from "react";
import {
  isConnected,
  requestAccess,
  setAllowed,
  getAddress
} from "@stellar/freighter-api";

const WalletContext = createContext(null);

function normalizeFreighterAddress(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return result.address || result.publicKey || "";
}

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAddress("");
  };

  const value = useMemo(
    () => ({
      address,
      loading,
      error,
      connectWallet,
      disconnectWallet,
      isConnected: Boolean(address)
    }),
    [address, loading, error]
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
