import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function Header({ theme, onToggleTheme }) {
  const { address, balance, isConnected, connectWallet, disconnectWallet, loading } =
    useWallet();

  return (
    <header className="topbar">
      <Link to="/" className="logo">
        SkillX
      </Link>

      {isConnected ? (
        <nav className="navlinks">
          <Link to="/home">Home</Link>
          <Link to="/role">Role</Link>
          <Link to="/client">Client</Link>
          <Link to="/freelancer">Freelancer</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      ) : (
        <div />
      )}

      <div className="walletbox">
        <button className="ghost theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        {isConnected ? (
          <>
            <div className="wallet-info">
              <span className="balance-pill">{balance} XLM</span>
              <span className="wallet-pill">{shortAddress(address)}</span>
            </div>
            <button onClick={disconnectWallet}>Disconnect</button>
          </>
        ) : (
          <button onClick={connectWallet} disabled={loading}>
            {loading ? "Connecting..." : "Connect Freighter"}
          </button>
        )}
      </div>
    </header>
  );
}
