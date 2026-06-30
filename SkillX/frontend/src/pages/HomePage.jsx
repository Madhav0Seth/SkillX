import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

const platformStats = [
  { value: "4", label: "Soroban contracts" },
  { value: "100%", label: "milestone escrow" },
  { value: "Live", label: "Stellar testnet" }
];

const workflowCards = [
  {
    step: "01",
    title: "Create a verified profile",
    text: "Set your role, skills, portfolio, and identity once. SkillX uses your wallet as the account anchor."
  },
  {
    step: "02",
    title: "Work through milestones",
    text: "Clients post structured jobs, freelancers accept open work, and each milestone moves in order."
  },
  {
    step: "03",
    title: "Settle with escrow",
    text: "Funds stay locked until approval, then payment releases through the on-chain escrow flow."
  }
];

export default function HomePage() {
  const { hasProfile, profile } = useWallet();
  const firstName = profile?.name?.split(" ")?.[0] || "builder";

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="home-kicker">
            {hasProfile ? `Welcome back, ${firstName}` : "Profile setup required"}
          </span>
          <h1>
            Welcome to <span>SkillX</span>
          </h1>
          <p>
            A polished Web3 workspace for hiring, freelancing, milestone tracking,
            and escrow-backed payments on Stellar.
          </p>
          <div className="home-actions">
            {hasProfile ? (
              <>
                <Link className="btn-link home-primary-action" to="/client">
                  Open Client Desk
                </Link>
                <Link className="btn-link ghost" to="/freelancer">
                  Open Freelancer Desk
                </Link>
              </>
            ) : (
              <Link className="btn-link home-primary-action" to="/role">
                Complete Registration
              </Link>
            )}
          </div>
        </div>

        <aside className="home-command-panel" aria-label="SkillX status overview">
          <div className="home-panel-header">
            <span>Marketplace status</span>
            <strong>Ready</strong>
          </div>
          <div className="home-stat-grid">
            {platformStats.map((stat) => (
              <div className="home-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <div className="home-route-list">
            <Link to="/client">
              <span>Client flow</span>
              <strong>Post jobs and approve payouts</strong>
            </Link>
            <Link to="/freelancer">
              <span>Freelancer flow</span>
              <strong>Accept work and submit milestones</strong>
            </Link>
            <Link to="/profile">
              <span>Profile</span>
              <strong>Wallet, reputation, and history</strong>
            </Link>
          </div>
        </aside>
      </section>

      <section className="home-workflow" aria-label="How SkillX works">
        {workflowCards.map((card) => (
          <article className="home-workflow-card" key={card.step}>
            <span>{card.step}</span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </section>

      <section className="home-split">
        <div className="home-feature-block">
          <span className="home-section-label">For clients</span>
          <h2>Hire with clear scope and protected funds.</h2>
          <p>
            Create a job, break it into milestones, fund escrow, and release
            payments only after submitted work is approved.
          </p>
          <Link className="btn-link ghost" to="/client">Manage client work</Link>
        </div>
        <div className="home-feature-block home-feature-block-alt">
          <span className="home-section-label">For freelancers</span>
          <h2>Find work, submit proof, and get paid on-chain.</h2>
          <p>
            Browse open jobs, accept the right project, submit milestone URLs,
            and track payment status from one workspace.
          </p>
          <Link className="btn-link ghost" to="/freelancer">Manage freelance work</Link>
        </div>
      </section>
    </div>
  );
}
