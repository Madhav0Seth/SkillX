function shortAddress(value) {
  if (!value) return "Open";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
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

  return (
    <article className={`card job-card job-card-${variant} ${isSelected ? "card-selected" : ""}`}>
      <div className="job-card-header">
        <h3>{job.title}</h3>
        <span className={`status-pill status-pill-${tone}`}>
          {label}
        </span>
      </div>
      <p>{job.description}</p>
      <div className="job-meta">
        <small>Job ID: {job.job_id}</small>
        <small>Client: {shortAddress(job.client_wallet)}</small>
        <small>Freelancer: {shortAddress(job.freelancer_wallet)}</small>
        {paymentAmount != null && <small>Received: {paymentAmount}</small>}
        <small>Created: {job.created_at ? new Date(job.created_at).toLocaleString() : "Unknown"}</small>
      </div>
      {(onAccept || onSelect) && (
        <div className="row-actions">
          {onSelect && (
            <button className="ghost" onClick={() => onSelect(job)}>
              {isSelected ? "Selected" : "View Details"}
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
