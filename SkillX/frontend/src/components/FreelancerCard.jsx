import UserHoverCard from "./UserHoverCard";

function shortAddress(value) {
  if (!value) return "Unknown wallet";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatValue(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export default function FreelancerCard({ freelancer, onSelect }) {
  const reputation = freelancer.reputation || {};
  const completedJobs = Number(reputation.completed_jobs || 0);
  const onTime = reputation.ontime_delivery_pct ?? null;
  const settledValue = Number(reputation.total_value_settled || 0);

  return (
    <article className="card freelancer-card">
      <div className="freelancer-identity-row">
        <UserHoverCard walletAddress={freelancer.wallet_address} name={freelancer.name} avatarUrl={freelancer.avatar_url}>
          <div className="avatar-image-circle" style={{ width: "42px", height: "42px", borderWidth: "2px" }}>
            {freelancer.avatar_url ? (
              <img src={freelancer.avatar_url} alt="Freelancer Avatar" />
            ) : (
              <span style={{ fontSize: "1.2rem", opacity: 0.5 }}>👤</span>
            )}
          </div>
          <div className="freelancer-card-header" style={{ margin: 0 }}>
            <h3 title={freelancer.wallet_address} style={{ margin: 0, fontSize: "1.2rem" }}>
              {freelancer.name || shortAddress(freelancer.wallet_address)}
            </h3>
            <small className="wallet-address-text" style={{ fontSize: "0.75rem", opacity: 0.7, wordBreak: "break-all" }}>
              {freelancer.wallet_address}
            </small>
          </div>
        </UserHoverCard>
      </div>
      <div className="reputation-badge" style={{ marginBottom: "0.9rem" }}>
        <div className="reputation-badge-title">Reputation</div>
        <div className="reputation-badge-metrics">
          <span>{completedJobs} completed</span>
          {onTime !== null && <span>{onTime}% on-time</span>}
          {settledValue > 0 && <span>{formatValue(settledValue)} USDC</span>}
        </div>
        <div className="reputation-badge-caption">
          {reputation.summary || (completedJobs > 0 ? "Verified activity" : "No completed jobs yet")}
        </div>
      </div>
      <p style={{ margin: "0 0 1rem" }}>{freelancer.bio || "No bio yet"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem", opacity: 0.85, marginBottom: "1rem" }}>
        <span><strong>Skills:</strong> {(freelancer.skills || []).join(", ") || "N/A"}</span>
        <span>
          <strong>Portfolio:</strong>{" "}
          {freelancer.portfolio ? (
            <a href={freelancer.portfolio} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
              {freelancer.portfolio}
            </a>
          ) : (
            "N/A"
          )}
        </span>
      </div>
      {onSelect && (
        <button className="ghost" onClick={() => onSelect(freelancer)} style={{ width: "100%" }}>
          Use Freelancer
        </button>
      )}
    </article>
  );
}
