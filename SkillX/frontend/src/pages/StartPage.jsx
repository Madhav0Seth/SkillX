import { Navigate, Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function StartPage() {
  const { isConnected, connectWallet, loading, error } = useWallet();

  if (isConnected) {
    return <Navigate to="/home" replace />;
  }

  return (
    <section className="start-gate">
      <div className="start-visual" aria-hidden="true">
        <span className="orbit orbit-a" />
        <span className="orbit orbit-b" />
        <span className="orbit orbit-c" />
        <div className="pulse-core" />
      </div>
      <div className="start-card">
        <h1 className="start-logo">SkillX</h1>
        <p>Connect your Freighter wallet to continue.</p>
        <button onClick={connectWallet} disabled={loading}>
          {loading ? "Connecting..." : "Connect Freighter"}
        </button>
        {error && <p className="status">{error}</p>}
        <small>Wallet connection is required before accessing the app.</small>
        <Link to="/" className="hidden-link" aria-hidden="true" />
      </div>
    </section>
  );
}
