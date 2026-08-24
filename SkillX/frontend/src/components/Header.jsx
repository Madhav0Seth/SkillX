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
            <button onClick={handleConnect} disabled={loading}>
              {loading ? "Connecting..." : "Connect Freighter"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
