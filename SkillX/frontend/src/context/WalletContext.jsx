import { createContext, useContext, useMemo, useState } from "react";
import {
  isConnected,
  requestAccess,
  setAllowed,
  getAddress
} from "@stellar/freighter-api";
import { Horizon } from "@stellar/stellar-sdk";

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
  };

  const value = useMemo(
    () => ({
      address,
      balance,
      loading,
      error,
      connectWallet,
      disconnectWallet,
      fetchBalance,
      isConnected: Boolean(address)
    }),
    [address, balance, loading, error]
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
