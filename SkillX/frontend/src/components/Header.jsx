import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function Header({ theme, onToggleTheme }) {
  const { address, balance, isConnected, connectWallet, disconnectWallet, loading, role, hasProfile } =
    useWallet();
  const [isOpen, setIsOpen] = useState(false);

  // Show nav links based on registered role
  const showClient = role === "client" || role === "both";
  const showFreelancer = role === "freelancer" || role === "both";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Link to="/" className="logo" onClick={() => setIsOpen(false)}>
          SkillX
        </Link>
        <button
          className={`hamburger-btn ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Navigation Menu"
          aria-expanded={isOpen}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      </div>

      <div className={`topbar-menu ${isOpen ? "open" : ""}`}>
        <nav className="navlinks">
          <Link to="/marketplace" onClick={() => setIsOpen(false)}>Marketplace</Link>
          {isConnected && (
            <>
              <Link to="/home" onClick={() => setIsOpen(false)}>Home</Link>
              {showClient && <Link to="/client" onClick={() => setIsOpen(false)}>Client</Link>}
              {showFreelancer && <Link to="/freelancer" onClick={() => setIsOpen(false)}>Freelancer</Link>}
              <Link to="/profile" onClick={() => setIsOpen(false)}>Profile</Link>
              <Link to="/role" onClick={() => setIsOpen(false)}>{hasProfile ? "Edit Role" : "Set Role"}</Link>
            </>
          )}
        </nav>

        <div className="walletbox">
          <a
            className="ghost"
            href="https://docs.google.com/forms/d/e/1FAIpQLSffAdXqPWPjtufDt_UxySfMGKZCTgQSbW9UiDb0Wv4VFNiFYg/viewform?usp=publish-editor"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "0.88rem", padding: "0.4rem 0.8rem", whiteSpace: "nowrap", display: "inline-block", textDecoration: "none" }}
            title="Give Product Feedback"
          >
            📝 Feedback
          </a>
          <button className="ghost theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {isConnected ? (
            <>
              <div className="wallet-info">
                {role && <span className="balance-pill" style={{ textTransform: "capitalize" }}>{role}</span>}
                <span className="balance-pill">{balance} XLM</span>
                <span className="wallet-pill">{shortAddress(address)}</span>
              </div>
              <button onClick={() => { disconnectWallet(); setIsOpen(false); }}>Disconnect</button>
            </>
          ) : (
            <button onClick={() => { connectWallet(); setIsOpen(false); }} disabled={loading}>
              {loading ? "Connecting..." : "Connect Freighter"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
