export default function JobCard({ job, onAccept, onReject }) {
  return (
    <article className="card">
      <h3>{job.title}</h3>
      <p>{job.description}</p>
      <small>Client: {job.client_wallet}</small>
      <small>Job Hash: {job.job_hash}</small>
      {onAccept && (
        <div className="row-actions">
          <button onClick={() => onAccept(job)}>Accept</button>
          <button className="ghost" onClick={() => onReject(job)}>
            Reject
          </button>
        </div>
      )}
    </article>
  );
}
