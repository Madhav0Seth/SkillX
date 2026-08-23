import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatWholeBalance(value) {
  if (!value) return "0";
  const cleaned = String(value).replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return Math.round(num).toLocaleString();
}

export default function Header({ theme, onToggleTheme }) {
  const { address, balance, isConnected, connectWallet, disconnectWallet, loading, role, hasProfile, profile } =
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
          <Link to="/roadmap" onClick={() => setIsOpen(false)}>Roadmap</Link>
          <Link to="/profile" onClick={() => setIsOpen(false)}>Profile</Link>
          {isConnected && (
            <>
              <Link to="/home" onClick={() => setIsOpen(false)}>Home</Link>
              {showClient && <Link to="/client" onClick={() => setIsOpen(false)}>Client</Link>}
              {showFreelancer && <Link to="/freelancer" onClick={() => setIsOpen(false)}>Freelancer</Link>}
              <Link to="/role" onClick={() => setIsOpen(false)}>{hasProfile ? "Edit Role" : "Set Role"}</Link>
            </>
          )}
        </nav>

        <div className="walletbox">
          <a
            className="feedback-btn"
            href="https://docs.google.com/forms/d/e/1FAIpQLSffAdXqPWPjtufDt_UxySfMGKZCTgQSbW9UiDb0Wv4VFNiFYg/viewform?usp=publish-editor"
            target="_blank"
            rel="noreferrer"
            title="Give Product Feedback"
          >
            <span className="feedback-btn-icon">💬</span> Feedback
          </a>
          <button className="ghost theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {isConnected ? (
            <>
              <div className="wallet-info">
                {role && <span className="balance-pill" style={{ textTransform: "capitalize" }}>{role}</span>}
                <span className="balance-pill">{formatWholeBalance(balance)} XLM</span>
                {hasProfile && profile?.name ? (
                  <span className="wallet-pill profile-name-pill" title={address}>
                    👤 {profile.name}
                  </span>
                ) : (
                  <span className="wallet-pill unreg-pill" title={address}>
                    {shortAddress(address)} (Unregistered)
                  </span>
                )}
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
