export default function JobCard({ job, onAccept, onReject, onSelect, isSelected }) {
  return (
    <article className={`card ${isSelected ? "card-selected" : ""}`}>
      <h3>{job.title}</h3>
      <p>{job.description}</p>
      <small>Job ID: {job.job_id}</small>
      <small>Client: {job.client_wallet}</small>
      <small>Job Hash: {job.job_hash}</small>
      {(onAccept || onSelect) && (
        <div className="row-actions">
          {onSelect && (
            <button className="ghost" onClick={() => onSelect(job)}>
              {isSelected ? "Selected" : "Select Job"}
            </button>
          )}
          {onAccept && <button onClick={() => onAccept(job)}>Accept</button>}
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
