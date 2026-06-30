import { useEffect, useState } from "react";
import { api } from "../services/api";

function shortAddress(value) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatValue(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

const STAT_ITEMS = [
  { key: "jobs_completed",      label: "Jobs Completed",       color: "var(--crayon-blue)" },
  { key: "total_value_settled",  label: "Value Settled",        color: "var(--crayon-green)", suffix: " USDC" },
  { key: "escrows_completed",    label: "Escrows Done",         color: "var(--crayon-purple)" },
  { key: "ontime_delivery_pct",  label: "On-time",              color: "var(--crayon-orange)", suffix: "%" },
  { key: "milestones_completed", label: "Milestones Done",      color: "var(--crayon-pink)" },
];

export default function ProfilePopup({ walletAddress, onClose }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileResult, statsResult] = await Promise.allSettled([
          api.getProfile(walletAddress),
          api.getProfileStats(walletAddress)
        ]);

        if (cancelled) return;

        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value.profile || null);
        }
        if (statsResult.status === "fulfilled") {
          setStats(statsResult.value.stats || null);
        }
        if (profileResult.status === "rejected" && statsResult.status === "rejected") {
          setError("Could not load profile data.");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const skills = profile?.skills || [];

  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="profile-popup-close" onClick={onClose} aria-label="Close profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading ? (
          <div className="profile-popup-loading">
            <div className="profile-popup-spinner" />
            <span>Loading profile…</span>
          </div>
        ) : error ? (
          <div className="profile-popup-error">
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Header: Avatar + Name + Role */}
            <div className="profile-popup-header">
              <div className="profile-popup-avatar">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" />
                ) : (
                  <span className="profile-popup-avatar-placeholder">👤</span>
                )}
              </div>
              <div className="profile-popup-identity">
                <h3 className="profile-popup-name">
                  {profile?.name || shortAddress(walletAddress)}
                </h3>
                {profile?.role && (
                  <span className="profile-popup-role">{profile.role.toUpperCase()}</span>
                )}
                <small className="profile-popup-wallet">{walletAddress}</small>
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <div className="profile-popup-bio">
                <p>{profile.bio}</p>
              </div>
            )}

            {/* Portfolio */}
            {profile?.portfolio && (
              <div className="profile-popup-portfolio">
                <strong>Portfolio:</strong>{" "}
                <a href={profile.portfolio} target="_blank" rel="noreferrer">
                  {profile.portfolio}
                </a>
              </div>
            )}

            {stats?.reputation && (
              <div className="reputation-card" style={{ marginBottom: "1rem" }}>
                <div className="reputation-card-header">
                  <span className="reputation-badge-title">Reputation</span>
                  <span className="reputation-card-chip">{stats.reputation.tier || "New"}</span>
                </div>
                <div className="reputation-card-metrics">
                  <span>{Number(stats.reputation.completed_jobs || 0)} completed</span>
                  <span>{Number(stats.reputation.ontime_delivery_pct || 0)}% on-time</span>
                  <span>{formatValue(stats.reputation.total_value_settled || 0)} USDC</span>
                </div>
                <small className="reputation-badge-caption">{stats.reputation.summary || "No completed jobs yet"}</small>
              </div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div className="profile-popup-skills">
                {skills.map((skill) => (
                  <span className="status-pill" key={skill}>{skill}</span>
                ))}
              </div>
            )}

            {/* Stats Grid */}
            {stats && (
              <div className="profile-popup-stats">
                {STAT_ITEMS.map(({ key, label, color, suffix }) => {
                  const value = stats[key];
                  const display = value !== null && value !== undefined
                    ? key === "total_value_settled"
                      ? formatValue(value)
                      : String(value)
                    : "0";
                  return (
                    <div className="profile-popup-stat" key={key} style={{ "--popup-stat-color": color }}>
                      <span className="profile-popup-stat-value">
                        {display}{value !== null && value !== undefined && suffix ? suffix : ""}
                      </span>
                      <span className="profile-popup-stat-label">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
