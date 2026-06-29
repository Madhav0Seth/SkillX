import { Navigate, Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function StartPage() {
  const { isConnected, connectWallet, loading, error, hasProfile, profileLoading, role } = useWallet();

  // Still loading profile after wallet connect — show a spinner
  if (isConnected && profileLoading) {
    return (
      <section className="start-gate">
        <div className="start-card">
          <h1 className="start-logo">SkillX</h1>
          <p>Loading your profile...</p>
        </div>
      </section>
    );
  }

  // Connected + profile exists → route based on role
  if (isConnected && hasProfile) {
    if (role === "client") return <Navigate to="/client" replace />;
    if (role === "freelancer") return <Navigate to="/freelancer" replace />;
    // role === "both" or anything else → go to home where they can choose
    return <Navigate to="/home" replace />;
  }

  // Connected but no profile → send them to role registration
  if (isConnected && !hasProfile) {
    return <Navigate to="/role" replace />;
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
