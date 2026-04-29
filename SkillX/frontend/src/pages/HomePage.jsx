import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <span className="badge">New Era of Freelancing</span>
          <h1>Hire top Web3 talent, <span className="text-gradient">fast.</span></h1>
          <p>
            The first Fiverr-style freelance marketplace built on Stellar. 
            Experience trustless milestones and secure on-chain escrow payments.
          </p>
          <div className="row-actions">
            <Link className="btn-link" to="/client">
              Hire Talent
            </Link>
            <Link className="btn-link ghost" to="/freelancer">
              Find Work
            </Link>
          </div>
        </div>
      </section>

      <section className="grid-cards">
        <div className="card">
          <h3>Trustless Escrow</h3>
          <p>Payments are held in smart contracts and only released upon milestone completion.</p>
        </div>
        <div className="card">
          <h3>Stellar Fast</h3>
          <p>Low fees and near-instant settlement powered by the Stellar network.</p>
        </div>
        <div className="card">
          <h3>Verified Talent</h3>
          <p>On-chain reputation system ensuring you work with the best in the industry.</p>
        </div>
      </section>
    </div>
  );
}
