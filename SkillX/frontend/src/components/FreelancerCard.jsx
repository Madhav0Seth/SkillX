import UserHoverCard from "./UserHoverCard";

function shortAddress(value) {
  if (!value) return "Unknown wallet";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function FreelancerCard({ freelancer, onSelect }) {
  return (
    <article className="card freelancer-card">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
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
