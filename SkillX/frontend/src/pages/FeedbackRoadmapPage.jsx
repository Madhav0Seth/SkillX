const REQUESTS = [
  { summary: "Reduce unnecessary wallet transactions and improve sync reliability.", completed: false },
  { summary: "Notify clients when a milestone is submitted for approval.", completed: false },
  { summary: "Make job posting, escrow funding, and milestone setup feel like one flow.", completed: false },
  { summary: "Add direct communication between the client and freelancer on a job.", completed: false },
  { summary: "Add skill-based marketplace filtering for better job discovery.", completed: false },
  { summary: "Show clearer, actionable errors when a transaction or sync is blocked.", completed: true },
];

export default function FeedbackRoadmapPage() {
  const openRequests = REQUESTS.filter((request) => !request.completed);
  const completedRequests = REQUESTS.filter((request) => request.completed);
  const total = REQUESTS.length;
  const completed = completedRequests.length;
  const progress = Math.max((completed / total) * 100, 14);

  return (
    <div className="feedback-board feedback-progress-page">
      <header className="feedback-board-hero">
        <span className="home-kicker">Feedback & Product Roadmap</span>
        <h1>What is open.<br /><span>What has shipped.</span></h1>
        <p>Tracking community feedback requests and shipped platform improvements on SkillX.</p>
        <div className="feedback-board-progress" aria-label={`${completed} of ${total} requests completed`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>{completed} completed, {openRequests.length} still open</small>
      </header>

      <section className="feedback-summary-strip" aria-label="Roadmap summary">
        <div>
          <strong>{openRequests.length}</strong>
          <span>Open Requests</span>
        </div>
        <div>
          <strong>{completed}</strong>
          <span>Completed Requests</span>
        </div>
        <div>
          <strong>{total}</strong>
          <span>Total Tracked</span>
        </div>
      </section>

      <section className="feedback-request-grid" aria-live="polite">
        {REQUESTS.map((request, index) => (
          <article
            key={request.summary}
            className={`feedback-request-card ${request.completed ? "feedback-request-complete" : ""}`}
          >
            <div className="feedback-request-topline">
              <span className="feedback-request-number">{String(index + 1).padStart(2, "0")}</span>
              <span className={`feedback-status-pill ${request.completed ? "feedback-status-pill-done" : "feedback-status-pill-open"}`}>
                {request.completed ? "COMPLETED" : "IN PROGRESS"}
              </span>
            </div>
            <p>{request.summary}</p>
            <div className="feedback-request-footnote">
              <span>{request.completed ? "Closed item" : "Queued next"}</span>
              <span>{request.completed ? "Already shipped ✅" : "In active dev 🔄"}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

