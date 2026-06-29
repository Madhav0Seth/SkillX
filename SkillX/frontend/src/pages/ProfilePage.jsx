import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";
import { api } from "../services/api";

const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

async function fetchXlmBalance(walletAddress) {
  const response = await fetch(
    `${HORIZON_TESTNET_URL}/accounts/${encodeURIComponent(walletAddress)}`
  );
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Wallet is not funded on Stellar testnet yet.");
    }
    throw new Error(data.detail || "Failed to fetch testnet balance.");
  }

  const nativeBalance = (data.balances || []).find(
    (balance) => balance.asset_type === "native"
  );
  return nativeBalance?.balance || "0";
}

function formatXlm(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7
  });
}

export default function ProfilePage() {
  const { address, profile } = useWallet();
  const walletAddress = normalizeWallet(address);
  const [clientJobs, setClientJobs] = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [xlmBalance, setXlmBalance] = useState("");
  const [balanceStatus, setBalanceStatus] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [status, setStatus] = useState("");

  const loadBalance = async () => {
    if (!walletAddress) {
      setXlmBalance("");
      setBalanceStatus("Connect wallet to view your XLM balance.");
      return;
    }

    try {
      setBalanceLoading(true);
      setBalanceStatus("");
      const balance = await fetchXlmBalance(walletAddress);
      setXlmBalance(balance);
    } catch (error) {
      setXlmBalance("");
      setBalanceStatus(error.message);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    const loadProfileData = async () => {
      setStatus("");
      setClientJobs([]);
      setFreelancerJobs([]);
      setXlmBalance("");
      setBalanceStatus("");

      if (!walletAddress) {
        setStatus("Connect wallet to view your profile.");
        setBalanceStatus("Connect wallet to view your XLM balance.");
        return;
      }

      try {
        const balance = await fetchXlmBalance(walletAddress);
        setXlmBalance(balance);
      } catch (error) {
        setBalanceStatus(error.message);
      }

      try {
        const [clientJobsResult, freelancerJobsResult] =
          await Promise.all([
            api.getJobs({ client_wallet: walletAddress, limit: 20 }),
            api.getJobs({
              freelancer_wallet: walletAddress,
              scope: "assigned",
              limit: 20
            })
          ]);

        setClientJobs(clientJobsResult.jobs || []);
        setFreelancerJobs(freelancerJobsResult.jobs || []);
      } catch (error) {
        setStatus(error.message);
      }
    };

    loadProfileData();
  }, [walletAddress]);

  const skills = profile?.skills || [];

  return (
    <section>
      <h2>Profile</h2>
      <div className="card balance-card">
        <div className="section-heading">
          <h3>Testnet XLM Balance</h3>
          <button className="ghost" onClick={loadBalance} disabled={balanceLoading}>
            {balanceLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <strong className="balance-amount">
          {xlmBalance ? `${formatXlm(xlmBalance)} XLM` : "-- XLM"}
        </strong>
        <small>Connected wallet: {address || "Connect wallet"}</small>
        {balanceStatus && <small className="inline-muted">{balanceStatus}</small>}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
          <div className="avatar-preview-lg" style={{ width: "85px", height: "85px", margin: 0 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" />
            ) : (
              <span className="avatar-preview-placeholder" style={{ fontSize: "2.4rem" }}>👤</span>
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.4rem" }}>
              {profile?.name || (profile?.role ? profile.role.toUpperCase() : "NO PROFILE")}
            </h3>
            <small style={{ opacity: 0.75, wordBreak: "break-all" }}>
              {profile?.role ? `${profile.role.toUpperCase()} • ` : ""}{address || "Connect wallet"}
            </small>
          </div>
        </div>

        {profile ? (
          <>
            <p>
              <strong>Bio:</strong> {profile.bio || "No bio added yet."}
            </p>
            <p>
              <strong>Portfolio:</strong>{" "}
              {profile.portfolio ? (
                <a href={profile.portfolio} target="_blank" rel="noreferrer">
                  {profile.portfolio}
                </a>
              ) : (
                "No portfolio added yet."
              )}
            </p>
            <div className="pill-row">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <span className="status-pill" key={skill}>
                    {skill}
                  </span>
                ))
              ) : (
                <span className="status-pill">No skills listed</span>
              )}
            </div>
          </>
        ) : (
          <p><Link to="/role">Set up your profile</Link> to get started on SkillX.</p>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Jobs Assigned to Me</h3>
          <span>{freelancerJobs.length} jobs</span>
        </div>
        {freelancerJobs.length > 0 ? (
          <div className="grid-cards">
            {freelancerJobs.map((job) => (
              <JobCard key={job.job_id} job={job} variant="assigned" />
            ))}
          </div>
        ) : (
          <p className="empty-state">No assigned freelancer jobs yet.</p>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Jobs I Created</h3>
          <span>{clientJobs.length} jobs</span>
        </div>
        {clientJobs.length > 0 ? (
          <div className="grid-cards">
            {clientJobs.map((job) => (
              <JobCard key={job.job_id} job={job} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No client jobs created from this wallet yet.</p>
        )}
      </div>

      {status && <p className="status">{status}</p>}
    </section>
  );
}
