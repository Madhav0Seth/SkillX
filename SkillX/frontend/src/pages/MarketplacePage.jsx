import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import JobCard from "../components/JobCard";
import { useWallet } from "../context/WalletContext";

export default function MarketplacePage() {
  const { isConnected, connectWallet, loading: walletLoading } = useWallet();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.getJobs({ scope: "open", limit: 50 });
      setJobs(result.jobs || []);
    } catch (requestError) {
      setJobs([]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const filteredJobs = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return jobs;
    return jobs.filter((job) => `${job.title} ${job.description}`.toLowerCase().includes(search));
  }, [jobs, query]);

  return (
    <div className="home-page" style={{ paddingTop: "1.5rem" }}>
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <span className="home-kicker">Explore Opportunities</span>
        <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0" }}>Public Job <span>Marketplace</span></h1>
        <p className="subtitle">Browse currently open jobs. Listings are live data only.</p>
      </header>
      <div className="card" style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "2rem" }}>
        <input aria-label="Search open jobs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search open jobs" />
        <button className="ghost" onClick={loadJobs} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {!isConnected && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <strong>Ready to take on work?</strong>
          <p>Connect Freighter to accept an open job from your freelancer dashboard.</p>
          <button onClick={connectWallet} disabled={walletLoading}>{walletLoading ? "Connecting…" : "Connect Freighter"}</button>
        </div>
      )}
      {error ? (
        <div className="empty-state-container"><h4>Marketplace unavailable</h4><p>{error}</p><button onClick={loadJobs}>Try again</button></div>
      ) : loading ? (
        <p className="empty-state">Loading open jobs…</p>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state-container"><h4>No open jobs found</h4><p>{query ? "Try a different search." : "Check back when a client posts a job."}</p></div>
      ) : (
        <div className="grid-cards">
          {filteredJobs.map((job) => <JobCard key={job.job_id} job={job} />)}
        </div>
      )}
      {isConnected && filteredJobs.length > 0 && <p className="status">Ready to apply? <Link to="/freelancer">Open your freelancer dashboard.</Link></p>}
    </div>
  );
}
