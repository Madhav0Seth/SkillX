function shortAddress(value) {
  if (!value) return "Unknown wallet";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function FreelancerCard({ freelancer, onSelect }) {
  return (
    <article className="card freelancer-card">
      <div className="freelancer-card-header">
        <h3 title={freelancer.wallet_address}>
          {shortAddress(freelancer.wallet_address)}
        </h3>
        <small className="wallet-address-text">{freelancer.wallet_address}</small>
      </div>
      <p>{freelancer.bio || "No bio yet"}</p>
      <small>Skills: {(freelancer.skills || []).join(", ") || "N/A"}</small>
      <small>Portfolio: {freelancer.portfolio || "N/A"}</small>
      {onSelect && (
        <button className="ghost" onClick={() => onSelect(freelancer)}>
          Use Freelancer
        </button>
      )}
    </article>
  );
}
