import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${el.getBoundingClientRect().height}px`
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleConnect = async () => {
    setIsOpen(false);
    await connectWallet();
    navigate("/home");
  };

  // Show nav links based on registered role
  const showClient = role === "client" || role === "both";
  const showFreelancer = role === "freelancer" || role === "both";

  return (
    <header className="topbar" ref={headerRef}>
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
          {!isConnected && <Link to="/marketplace" onClick={() => setIsOpen(false)}>Marketplace</Link>}
          <Link to="/docs" onClick={() => setIsOpen(false)}>Docs</Link>
          <Link to="/roadmap" onClick={() => setIsOpen(false)}>Feedback</Link>
          <Link to="/profile" onClick={() => setIsOpen(false)}>Profile</Link>
          {isConnected && (
            <>
              {showClient && <Link to="/client" onClick={() => setIsOpen(false)}>Client</Link>}
              {showFreelancer && <Link to="/freelancer" onClick={() => setIsOpen(false)}>Freelancer</Link>}
            </>
          )}
        </nav>

        <div className="walletbox">
          <button className="ghost theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {isConnected ? (
            <>
              <div className="wallet-info">
                {role && <span className="balance-pill" style={{ textTransform: "capitalize" }}>{role}</span>}
                <span className="balance-pill">{formatWholeBalance(balance)} XLM</span>
                {hasProfile && profile?.name ? (
                  <span className="wallet-pill profile-name-pill" title={address} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {profile.name}
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
            <button onClick={handleConnect} disabled={loading}>
              {loading ? "Connecting..." : "Connect Freighter"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
