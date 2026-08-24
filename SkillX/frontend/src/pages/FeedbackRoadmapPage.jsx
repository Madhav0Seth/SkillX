const REQUESTS = [
  { summary: "Reduce unnecessary wallet transactions and improve sync reliability.", completed: true },
  { summary: "Notify clients when a milestone is submitted for approval.", completed: false },
  { summary: "Make job posting, escrow funding, and milestone setup feel like one flow.", completed: true },
  { summary: "Add direct communication between the client and freelancer on a job.", completed: false },
  { summary: "Add skill-based marketplace filtering for better job discovery.", completed: true },
  { summary: "Show clearer, actionable errors when a transaction or sync is blocked.", completed: true },
  { summary: "Add wallet transaction loading states", completed: true },
];

export default function FeedbackRoadmapPage() {
  const openRequests = REQUESTS.filter((request) => !request.completed);
  const completedRequests = REQUESTS.filter((request) => request.completed);
  const total = REQUESTS.length;
  const completed = completedRequests.length;
  const progress = Math.max((completed / total) * 100, 14);

  return (
    <div className="feedback-board feedback-progress-page">
      <section className="feedback-form-section" aria-labelledby="feedback-form-title">
        <div className="feedback-form-copy" style={{ marginBottom: '2.5rem' }}>
          <span className="home-kicker">Feedback</span>
          <h1 id="feedback-form-title">We appreciate your feedback!</h1>
          <p>
            Help shape the future of SkillX. Your thoughts, suggestions, and feature requests are highly valued by our team as we continue to build out the platform.
          </p>
        </div>
        <a
          className="feedback-form-link"
          href="https://docs.google.com/forms/d/e/1FAIpQLSffAdXqPWPjtufDt_UxySfMGKZCTgQSbW9UiDb0Wv4VFNiFYg/viewform?usp=publish-editor"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            padding: '1rem 2rem',
            background: 'var(--primary)',
            color: 'white',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '1.1rem',
            boxShadow: '4px 4px 0 var(--border)'
          }}
        >
          Open Feedback Form
        </a>
      </section>

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
