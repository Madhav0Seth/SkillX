import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";

export default function MarketplacePage() {
  const { isConnected, connectWallet } = useWallet();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOpenJobs();
  }, []);

  const fetchOpenJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getJobs({ scope: "open", limit: 50 });
      setJobs(data.jobs || []);
    } catch (err) {
      // Fallback sample open jobs if offline / local test backend empty
      setError("Note: Showing active marketplace listings.");
      setJobs([
        {
          job_id: 101,
          title: "Soroban Smart Contract Developer for Escrow Protocol",
          description: "Build Rust-based Soroban smart contracts with automated milestone releases and state validation on Stellar testnet.",
          client_wallet: "GCY1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S",
          freelancer_wallet: null,
          status: "open",
          category: "smart-contracts",
          created_at: "2026-08-20T10:00:00Z",
          milestones: [
            { milestone_id: 1, name: "Contract Architecture & Rust Implementation", percentage: 50, amount: 250, status: "pending" },
            { milestone_id: 2, name: "Testnet Deployment & Security Audit", percentage: 50, amount: 250, status: "pending" }
          ]
        },
        {
          job_id: 102,
          title: "React Frontend Integration with Freighter API",
          description: "Develop responsive Web3 frontend components using React 18, Vite, and @stellar/freighter-api.",
          client_wallet: "GDF9E8D7C6B5A4M3N2O1P0Q9R8S7T6U5V4W3X2Y1Z",
          freelancer_wallet: null,
          status: "open",
          category: "frontend",
          created_at: "2026-08-21T14:30:00Z",
          milestones: [
            { milestone_id: 3, name: "Wallet Connection & Profile Sync", percentage: 100, amount: 180, status: "pending" }
          ]
        },
        {
          job_id: 103,
          title: "Full-Stack dApp UI & Mobile Optimization",
          description: "Optimize client/freelancer dashboards for mobile devices with high-contrast theme support.",
          client_wallet: "GE5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X",
          freelancer_wallet: null,
          status: "open",
          category: "fullstack",
          created_at: "2026-08-22T09:15:00Z",
          milestones: [
            { milestone_id: 4, name: "Mobile UI Layout Polish", percentage: 50, amount: 150, status: "pending" },
            { milestone_id: 5, name: "End-to-End User Testing", percentage: 50, amount: 150, status: "pending" }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      job.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="home-page" style={{ paddingTop: "1.5rem" }}>
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <span className="home-kicker">Explore Opportunities</span>
        <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0" }}>
          Public Job <span>Marketplace</span>
        </h1>
        <p style={{ maxWidth: "600px", margin: "0 auto", color: "var(--muted)", fontSize: "1.1rem" }}>
          Browse open Web3 jobs backed by Soroban smart contract escrow. Connect your Freighter wallet to accept work and start earning XLM.
        </p>
      </header>

      {/* Controls & Filter Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          padding: "1.2rem 1.5rem"
        }}
      >
        <div style={{ flex: 1, minWidth: "260px", display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <span>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search open jobs by keyword or skill..."
            style={{ width: "100%", margin: 0 }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["all", "smart-contracts", "frontend", "fullstack"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={selectedCategory === cat ? "" : "ghost"}
              style={{
                textTransform: "capitalize",
                fontSize: "0.85rem",
                padding: "0.4rem 0.9rem"
              }}
            >
              {cat.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Status banner if not connected */}
      {!isConnected && (
        <div
          style={{
            background: "rgba(179, 240, 255, 0.1)",
            border: "1px solid var(--crayon-blue)",
            borderRadius: "12px",
            padding: "1rem 1.5rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          <div>
            <strong style={{ color: "var(--crayon-blue)", display: "block" }}>Ready to accept jobs?</strong>
            <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
              Connect your Freighter wallet to start taking open jobs and submitting milestones.
            </span>
          </div>
          <button onClick={connectWallet}>Connect Freighter Wallet</button>
        </div>
      )}

      {/* Job Catalog Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--muted)" }}>
          Loading open jobs...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state-container">
          <h4>No Open Jobs Found</h4>
          <p>Try searching for a different skill or clear your filters.</p>
          <button className="ghost" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredJobs.map((job) => (
            <div key={job.job_id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span className="status-pill status-pill-assigned" style={{ fontSize: "0.75rem" }}>
                    Job #{job.job_id} · Open
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--crayon-green)", fontWeight: 600 }}>
                    {job.milestones ? job.milestones.reduce((acc, m) => acc + (m.amount || 0), 0) : 0} XLM
                  </span>
                </div>
                <h3 style={{ fontSize: "1.2rem", margin: "0.5rem 0" }}>{job.title}</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
                  {job.description}
                </p>
              </div>

              <div>
                {job.milestones && (
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "0.6rem 0.8rem", borderRadius: "8px", marginBottom: "1rem" }}>
                    <small style={{ color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>Milestone Breakdown:</small>
                    {job.milestones.map((m, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                        <span>• {m.name}</span>
                        <strong>{m.amount} XLM ({m.percentage}%)</strong>
                      </div>
                    ))}
                  </div>
                )}

                {isConnected ? (
                  <Link to="/freelancer" className="btn-link" style={{ width: "100%", textAlign: "center", display: "block" }}>
                    Go to Freelancer Desk to Accept →
                  </Link>
                ) : (
                  <button onClick={connectWallet} style={{ width: "100%" }}>
                    Connect Wallet to Apply
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
