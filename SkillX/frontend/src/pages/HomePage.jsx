import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Hire top Web3 talent, fast.</h1>
      <p>
        Fiverr-style freelance marketplace on Stellar with trustless milestones
        and on-chain escrow workflow.
      </p>
      <div className="row-actions">
        <Link className="btn-link" to="/client">
          I am a Client
        </Link>
        <Link className="btn-link ghost" to="/freelancer">
          I am a Freelancer
        </Link>
      </div>
    </section>
  );
}
