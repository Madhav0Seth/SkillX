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
  variant = "default"
}) {
  const isAssigned = Boolean(job.freelancer_wallet);
  const statusLabel = isAssigned ? "Assigned" : "Open";

  return (
    <article className={`card job-card job-card-${variant} ${isSelected ? "card-selected" : ""}`}>
      <div className="job-card-header">
        <h3>{job.title}</h3>
        <span className={`status-pill ${isAssigned ? "status-pill-assigned" : "status-pill-open"}`}>
          {statusLabel}
        </span>
      </div>
      <p>{job.description}</p>
      <div className="job-meta">
        <small>Job ID: {job.job_id}</small>
        <small>Client: {shortAddress(job.client_wallet)}</small>
        <small>Freelancer: {shortAddress(job.freelancer_wallet)}</small>
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
