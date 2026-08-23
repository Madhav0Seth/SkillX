import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";
import { api } from "../services/api";

const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

async function fetchXlmBalance(walletAddress) {
  const response = await fetch(
    `${HORIZON_TESTNET_URL}/accounts/${encodeURIComponent(walletAddress)}`
  );
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Wallet is not funded on Stellar testnet yet.");
    }
    throw new Error(data.detail || "Failed to fetch testnet balance.");
  }

  const nativeBalance = (data.balances || []).find(
    (balance) => balance.asset_type === "native"
  );
  return nativeBalance?.balance || "0";
}

function formatXlm(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7
  });
}

function formatValue(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

const JobsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stat-svg-icon">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="currentColor" opacity="0.1" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

const ValueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stat-svg-icon">
    <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.1" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <path d="M14.25 9.75a1.5 1.5 0 0 0-1.5-1.5h-1.5a1.5 1.5 0 0 0 0 3h1.5a1.5 1.5 0 0 1 0 3h-1.5a1.5 1.5 0 0 1-1.5-1.5" />
  </svg>
);

const EscrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stat-svg-icon">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" opacity="0.1" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stat-svg-icon">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stat-svg-icon">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor" opacity="0.1" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const STAT_CONFIG = [
  { key: "jobs_completed",      label: "Jobs Completed",       icon: <JobsIcon />, color: "var(--crayon-blue)" },
  { key: "total_value_settled",  label: "Total Value Settled",  icon: <ValueIcon />, color: "var(--crayon-green)", suffix: " USDC" },
  { key: "escrows_completed",    label: "Escrows Completed",    icon: <EscrowIcon />, color: "var(--crayon-purple)" },
  { key: "ontime_delivery_pct",  label: "On-time Delivery",     icon: <ClockIcon />, color: "var(--crayon-orange)", suffix: "%" },
  { key: "milestones_completed", label: "Milestones Completed", icon: <FlagIcon />, color: "var(--crayon-pink)" },
];

export default function ProfilePage() {
  const { address, profile, connectWallet, loading: walletLoading } = useWallet();
  const walletAddress = normalizeWallet(address);
  const navigate = useNavigate();
  const [clientJobs, setClientJobs] = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [xlmBalance, setXlmBalance] = useState("");
  const [balanceStatus, setBalanceStatus] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const handleConnect = async () => {
    await connectWallet();
    navigate("/home");
  };

  const loadBalance = async () => {
    if (!walletAddress) {
      setXlmBalance("");
      setBalanceStatus("Connect wallet to view your XLM balance.");
      return;
    }

    try {
      setBalanceLoading(true);
      setBalanceStatus("");
      const balance = await fetchXlmBalance(walletAddress);
      setXlmBalance(balance);
    } catch (error) {
      setXlmBalance("");
      setBalanceStatus(error.message);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    const loadProfileData = async () => {
      setStatus("");
      setClientJobs([]);
      setFreelancerJobs([]);
      setXlmBalance("");
      setBalanceStatus("");
      setStats(null);

      if (!walletAddress) {
        setBalanceStatus("Connect wallet to view your XLM balance.");
        return;
      }

      try {
        const balance = await fetchXlmBalance(walletAddress);
        setXlmBalance(balance);
      } catch (error) {
        setBalanceStatus(error.message);
      }

      // Fetch stats
      try {
        setStatsLoading(true);
        const result = await api.getProfileStats(walletAddress);
        setStats(result.stats || null);
      } finally {
        setStatsLoading(false);
      }

      try {
        const [clientJobsResult, freelancerJobsResult] =
          await Promise.all([
            api.getJobs({ client_wallet: walletAddress, limit: 20 }),
            api.getJobs({
              freelancer_wallet: walletAddress,
              scope: "assigned",
              limit: 20
            })
          ]);

        setClientJobs(clientJobsResult.jobs || []);
        setFreelancerJobs(freelancerJobsResult.jobs || []);
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadProfileData();
  }, [walletAddress]);

  const skills = profile?.skills || [];
  const reputation = stats?.reputation || profile?.reputation || null;

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <div>
          <span className="home-kicker">Your workspace</span>
          <h1>Profile &amp; activity</h1>
          <p>Keep your skills, portfolio, and public profile up to date.</p>
        </div>
        <Link className="btn-link profile-edit-action" to="/role">
          {profile ? "Edit Profile" : "Set Up Profile"}
        </Link>
      </header>

      <div className="profile-layout">
      {/* ── Native Disconnected Wallet Card ── */}
      {!walletAddress && (
        <div className="card" style={{ gridColumn: "1 / -1", padding: "2rem" }}>
          <span className="home-kicker" style={{ marginBottom: "0.8rem" }}>Wallet Required</span>
          <h2 style={{ fontSize: "1.8rem", margin: "0.5rem 0" }}>Connect Freighter to View Profile</h2>
          <p style={{ margin: "0 0 1.2rem", color: "var(--muted)", maxWidth: "550px" }}>
            Connect your Stellar wallet to view your on-chain reputation, escrow balance, and account activity.
          </p>
          <button onClick={handleConnect} disabled={walletLoading}>
            {walletLoading ? "Connecting..." : "Connect Freighter"}
          </button>
        </div>
      )}

      {/* Sidebar: Profile and Balance Info */}
      <aside className="profile-sidebar">
        <div className="card balance-card">
          <div className="section-heading">
            <h3>Testnet XLM Balance</h3>
            <button className="ghost" onClick={loadBalance} disabled={balanceLoading}>
              {balanceLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <strong className="balance-amount">
            {xlmBalance ? `${formatXlm(xlmBalance)} XLM` : "-- XLM"}
          </strong>
          <small style={{ wordBreak: "break-all" }}>Connected: {address || "Connect wallet"}</small>
          {balanceStatus && <small className="inline-muted" style={{ wordBreak: "break-all" }}>{balanceStatus}</small>}
        </div>

        <div className="card profile-info-card">
          <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "1.2rem" }}>
            <div className="avatar-preview-lg" style={{ width: "65px", height: "65px", margin: 0 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" />
              ) : (
                <span className="avatar-preview-placeholder" style={{ fontSize: "2rem" }}>👤</span>
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem" }}>
                {profile?.name || (profile?.role ? profile.role.toUpperCase() : "UNREGISTERED USER")}
              </h3>
              <small style={{ opacity: 0.75, wordBreak: "break-all", fontSize: "0.8rem" }}>
                {profile?.role ? `${profile.role.toUpperCase()} • ` : ""}
                {address ? `${address.slice(0, 6)}...${address.slice(-6)}` : "No Wallet Connected"}
              </small>
            </div>
          </div>

          {profile ? (
            <>
              <p style={{ margin: "0.5rem 0", fontSize: "0.95rem" }}>
                <strong>Bio:</strong> {profile.bio || "No bio added yet."}
              </p>
              <p style={{ margin: "0.5rem 0", fontSize: "0.95rem" }}>
                <strong>Portfolio:</strong>{" "}
                {profile.portfolio ? (
                  <a href={profile.portfolio} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>
                    {profile.portfolio}
                  </a>
                ) : (
                  "No portfolio added yet."
                )}
              </p>
              {reputation && (
                <div className="reputation-card" style={{ marginTop: "1rem" }}>
                  <div className="reputation-card-header">
                    <span className="reputation-badge-title">Reputation</span>
                    <span className="reputation-card-chip">{reputation.tier || "New"}</span>
                  </div>
                  <div className="reputation-card-metrics">
                    <span>{Number(reputation.completed_jobs || 0)} completed</span>
                    <span>{Number(reputation.ontime_delivery_pct || 0)}% on-time</span>
                    <span>{formatValue(reputation.total_value_settled || 0)} USDC</span>
                  </div>
                  <small className="reputation-badge-caption">{reputation.summary || "No completed jobs yet"}</small>
                </div>
              )}
              <div className="pill-row" style={{ marginTop: "1rem" }}>
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <span className="status-pill" key={skill}>
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="status-pill">No skills listed</span>
                )}
              </div>
            </>
          ) : (
            <p>
              {address ? (
                <Link to="/role">Set up your profile</Link>
              ) : (
                "Connect Freighter wallet above to set up or view your profile."
              )}{" "}
              to get started on SkillX.
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area: Stats and Jobs */}
      <main className="profile-main">
        {/* ── Activity Overview Stats Grid ── */}
        <div className="profile-stats-card card">
          <div className="section-heading">
            <h3>Activity Overview</h3>
            {statsLoading && <span className="stats-loading-indicator">Loading…</span>}
          </div>
          <div className="profile-stats-grid">
            {STAT_CONFIG.map(({ key, label, icon, color, suffix }) => {
              const value = stats ? stats[key] : null;
              const displayValue = value !== null && value !== undefined
                ? key === "total_value_settled"
                  ? formatValue(value)
                  : String(value)
                : "--";
              return (
                <div className="profile-stat-item" key={key} style={{ "--stat-accent": color }}>
                  <span className="profile-stat-icon">{icon}</span>
                  <span className="profile-stat-value">
                    {displayValue}{value !== null && value !== undefined && suffix ? suffix : ""}
                  </span>
                  <span className="profile-stat-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-heading">
            <h3>Jobs Assigned to Me</h3>
            <span>{freelancerJobs.length} jobs</span>
          </div>
          {freelancerJobs.length > 0 ? (
            <div className="grid-cards">
              {freelancerJobs.map((job) => (
                <JobCard key={job.job_id} job={job} variant="assigned" />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              {walletAddress ? "No assigned freelancer jobs yet." : "Connect wallet to view assigned jobs."}
            </p>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-heading">
            <h3>Jobs I Created</h3>
            <span>{clientJobs.length} jobs</span>
          </div>
          {clientJobs.length > 0 ? (
            <div className="grid-cards">
              {clientJobs.map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              {walletAddress ? "No client jobs created from this wallet yet." : "Connect wallet to view created jobs."}
            </p>
          )}
        </div>
      </main>

        {status && <p className="status" style={{ gridColumn: "1 / -1" }}>{status}</p>}
      </div>
    </div>
  );
}
