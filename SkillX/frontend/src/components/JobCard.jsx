import UserHoverCard from "./UserHoverCard";

function shortAddress(value) {
  if (!value) return "Open";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatValue(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export default function JobCard({
  job,
  onAccept,
  onReject,
  onSelect,
  isSelected,
  variant = "default",
  statusLabel,
  statusTone = "default",
  paymentAmount
}) {
  const isAssigned = Boolean(job.freelancer_wallet);
  const label = statusLabel || (isAssigned ? "Assigned" : "Open");
  const tone = statusTone === "default" ? (isAssigned ? "assigned" : "open") : statusTone;
  const reputation = job.freelancer?.reputation || job.client?.reputation || null;

  return (
    <article className={`card job-card job-card-${variant} ${isSelected ? "card-selected" : ""}`}>
      <div className="job-card-header">
        <h3>{job.title}</h3>
        <span className={`status-pill status-pill-${tone}`}>
          {label}
        </span>
      </div>
      <p>{job.description}</p>

      {reputation && (
        <div className="reputation-badge" style={{ marginBottom: "0.8rem" }}>
          <div className="reputation-badge-title">Freelancer Reputation</div>
          <div className="reputation-badge-metrics">
            <span>{Number(reputation.completed_jobs || 0)} completed</span>
            <span>{Number(reputation.ontime_delivery_pct || 0)}% on-time</span>
            <span>{formatValue(reputation.total_value_settled || 0)} USDC</span>
          </div>
          <div className="reputation-badge-caption">{reputation.summary || "Verified delivery history"}</div>
        </div>
      )}
      
      <div className="job-meta">
        <div className="job-meta-item">
          <strong>Job ID:</strong> <span>{job.job_id}</span>
        </div>
        
        <div className="job-meta-item">
          <strong>Client:</strong>
          <UserHoverCard walletAddress={job.client_wallet} name={job.client?.name} avatarUrl={job.client?.avatar_url}>
            <div className="avatar-image-circle" style={{ width: "20px", height: "20px", borderWidth: "1.5px" }}>
              {job.client?.avatar_url ? (
                <img src={job.client.avatar_url} alt="Client Avatar" />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <span style={{ fontWeight: 600 }}>{job.client?.name || shortAddress(job.client_wallet)}</span>
          </UserHoverCard>
        </div>

        <div className="job-meta-item">
          <strong>Freelancer:</strong>
          <UserHoverCard walletAddress={job.freelancer_wallet} name={job.freelancer?.name} avatarUrl={job.freelancer?.avatar_url}>
            <div className="avatar-image-circle" style={{ width: "20px", height: "20px", borderWidth: "1.5px" }}>
              {job.freelancer?.avatar_url ? (
                <img src={job.freelancer.avatar_url} alt="Freelancer Avatar" />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <span style={{ fontWeight: 600 }}>{job.freelancer?.name || shortAddress(job.freelancer_wallet)}</span>
          </UserHoverCard>
        </div>

        {paymentAmount != null && (
          <div className="job-meta-item">
            <strong>Received:</strong> <span>{paymentAmount}</span>
          </div>
        )}
        
        <div className="job-meta-item">
          <strong>Created:</strong> <span>{job.created_at ? new Date(job.created_at).toLocaleString() : "Unknown"}</span>
        </div>
      </div>

      {(onAccept || onSelect) && (
        <div className="row-actions">
          {onSelect && (
            <button
              className="ghost"
              onClick={() => onSelect(job)}
              aria-pressed={isSelected}
              aria-label={isSelected ? `${job.title} selected` : `Select ${job.title}`}
            >
              {isSelected ? "Selected — View Submission" : "Select Job"}
            </button>
          )}
          {onAccept && !isAssigned && <button onClick={() => onAccept(job)}>Accept</button>}
          {onReject && (
            <button className="ghost" onClick={() => onReject(job)}>
              Reject
            </button>
          )}
        </div>
      )}
    </article>
  );
}
