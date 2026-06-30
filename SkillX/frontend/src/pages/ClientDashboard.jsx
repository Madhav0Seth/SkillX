import { useRef, useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import FreelancerCard from "../components/FreelancerCard";
import JobCard from "../components/JobCard";
import { getMilestoneStatus } from "../utils/contractStatus";
const EmptyState = ({ iconType, title, message, action }) => {
  const getIcon = () => {
    switch (iconType) {
      case "search":
        return (
          <svg viewBox="0 0 100 100" className="empty-state-svg" style={{ stroke: "var(--crayon-blue)" }}>
            <circle cx="45" cy="45" r="25" fill="none" strokeWidth="4" />
            <line x1="63" y1="63" x2="90" y2="90" strokeWidth="6" strokeLinecap="round" />
            <path d="M38 35a12 12 0 0 1 12 12" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3" />
          </svg>
        );
      case "jobs":
        return (
          <svg viewBox="0 0 100 100" className="empty-state-svg" style={{ stroke: "var(--crayon-purple)" }}>
            <rect x="20" y="20" width="60" height="68" rx="8" fill="none" strokeWidth="4" />
            <path d="M35 12h30v12H35z" fill="none" strokeWidth="4" />
            <line x1="35" y1="40" x2="65" y2="40" strokeWidth="4" strokeLinecap="round" />
            <line x1="35" y1="55" x2="65" y2="55" strokeWidth="4" strokeLinecap="round" />
            <line x1="35" y1="70" x2="55" y2="70" strokeWidth="4" strokeLinecap="round" />
            <circle cx="70" cy="40" r="4" fill="var(--crayon-purple)" />
            <circle cx="70" cy="55" r="4" fill="var(--crayon-purple)" />
          </svg>
        );
      case "select":
        return (
          <svg viewBox="0 0 100 100" className="empty-state-svg" style={{ stroke: "var(--crayon-yellow)" }}>
            <path d="M50 15 L85 80 L15 80 Z" fill="none" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="50" cy="65" r="4" fill="var(--crayon-yellow)" />
            <line x1="50" y1="35" x2="50" y2="52" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 100 100" className="empty-state-svg" style={{ stroke: "var(--crayon-pink)" }}>
            <circle cx="50" cy="50" r="35" fill="none" strokeWidth="4" />
            <line x1="35" y1="50" x2="65" y2="50" strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="35" x2="50" y2="65" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return (
    <div className="empty-state-container">
      <div className="empty-state-icon-wrapper">
        {getIcon()}
      </div>
      <h4>{title}</h4>
      <p>{message}</p>
      {action}
    </div>
  );
};

function emptyMilestone() {
  return {
    name: "",
    percentage: 100,
    amount: 0,
    deadline: ""
  };
}

function distributePercentages(count) {
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  return Array.from({ length: count }, (_, idx) =>
    idx < remainder ? base + 1 : base
  );
}

function hasRole(profile, role) {
  return profile?.role === role || profile?.role === "both";
}

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getMilestoneTotal(milestones = []) {
  return milestones.reduce((sum, milestone) => sum + Number(milestone.amount || 0), 0);
}

function toNumber(value) {
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

export default function ClientDashboard() {
  const { address } = useWallet();
  const reviewRef = useRef(null);
  const [category, setCategory] = useState("");
  const [freelancers, setFreelancers] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freelancerWallet, setFreelancerWallet] = useState("");
  const [milestones, setMilestones] = useState([emptyMilestone()]);
  const [myJobs, setMyJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState([]);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  const getStatusType = (msg) => {
    if (!msg) return "info";
    const lower = msg.toLowerCase();
    if (
      lower.includes("fail") ||
      lower.includes("error") ||
      lower.includes("incomplete") ||
      lower.includes("invalid") ||
      lower.includes("not registered") ||
      lower.includes("not configured") ||
      lower.includes("cannot") ||
      lower.includes("mismatch")
    ) {
      return "error";
    }
    if (
      lower.includes("success") ||
      lower.includes("created") ||
      lower.includes("funded") ||
      lower.includes("approved") ||
      lower.includes("released") ||
      lower.includes("synced") ||
      lower.includes("paid")
    ) {
      return "success";
    }
    return "info";
  };

  const handleDismiss = () => {
    setStatus("");
    setTxHash("");
  };

  const loadMyJobs = async () => {
    setStatus("");
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      const result = await api.getJobs({ client_wallet: address, limit: 30 });
      setMyJobs(result.jobs || []);
      if (!result.jobs?.length) {
        setStatus("No previous jobs found.");
      }
    } catch (error) {
      setStatus(`Failed to load previous jobs: ${error.message}`);
    }
  };

  const selectJob = async (job) => {
    setStatus("");
    try {
      const result = await api.getJob(job.job_id);
      setSelectedJob(result.job);
      setSelectedMilestones(result.milestones || []);
      requestAnimationFrame(() => {
        reviewRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    } catch (error) {
      setStatus(`Failed to load job details: ${error.message}`);
    }
  };

  const approveMilestone = async (milestone) => {
    if (!address || !selectedJob) {
      setStatus("Load a job and connect the client wallet first.");
      return;
    }
    try {
      const index = selectedMilestones.findIndex(
        (item) => Number(item.milestone_id) === Number(milestone.milestone_id)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }

      const onChainMilestone = await contracts.getMilestoneOnChain(
        selectedJob.job_hash,
        index
      );
      const onChainStatus = getMilestoneStatus(onChainMilestone);
      if (onChainStatus === "paid") {
        await api.approveMilestone(milestone.milestone_id, normalizeWallet(address));
        const refreshed = await api.getJob(selectedJob.job_id);
        setSelectedJob(refreshed.job);
        setSelectedMilestones(refreshed.milestones || []);
        setTxHash("");
        setStatus(`Approved milestone ${milestone.milestone_id}. Payment released to freelancer.`);
        return;
      }
      if (onChainStatus !== "submitted") {
        setStatus(
          `Cannot approve yet. On-chain milestone ${index} is ${onChainStatus || "unknown"}, but approval requires Submitted. Ask the freelancer to open this job and click Sync Submitted Milestone On-chain.`
        );
        return;
      }

      const milestoneAmount = Number(milestone.amount || 0);
      const escrowBalance = toNumber(
        await contracts.getEscrowBalanceOnChain(selectedJob.job_hash)
      );
      if (escrowBalance < milestoneAmount) {
        const missingAmount = milestoneAmount - escrowBalance;
        await contracts.depositEscrowOnChain(
          selectedJob.job_hash,
          address,
          missingAmount
        );
      }

      const txResult = await contracts.approveMilestoneOnChain(
        selectedJob.job_hash,
        index,
        normalizeWallet(address)
      );
      await api.approveMilestone(milestone.milestone_id, normalizeWallet(address));

      setTxHash(txResult.hash);
      const refreshed = await api.getJob(selectedJob.job_id);
      setSelectedJob(refreshed.job);
      setSelectedMilestones(refreshed.milestones || []);
      const isJobComplete = (refreshed.milestones || []).every(
        (item) => item.status === "approved"
      );
      setStatus(
        isJobComplete
          ? `Approved milestone ${milestone.milestone_id}. Final payment released and job completed.`
          : `Approved milestone ${milestone.milestone_id}. Payment released to freelancer.`
      );
    } catch (error) {
      const message = error.message.includes("InvalidAction")
        ? `Approval failed on-chain. Fund escrow first, confirm this milestone is submitted, and approve with the client wallet. Details: ${error.message}`
        : `Approval failed: ${error.message}`;
      setStatus(message);
    }
  };

  const syncApprovedPaymentOnChain = async (milestone) => {
    if (!address || !selectedJob) {
      setStatus("Load a job and connect the client wallet first.");
      return;
    }

    try {
      const index = selectedMilestones.findIndex(
        (item) => Number(item.milestone_id) === Number(milestone.milestone_id)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }

      const onChainMilestone = await contracts.getMilestoneOnChain(
        selectedJob.job_hash,
        index
      );
      const onChainStatus = getMilestoneStatus(onChainMilestone);
      if (onChainStatus === "paid") {
        await api.approveMilestone(milestone.milestone_id, normalizeWallet(address));
        const refreshed = await api.getJob(selectedJob.job_id);
        setSelectedJob(refreshed.job);
        setSelectedMilestones(refreshed.milestones || []);
        setStatus(`Milestone ${index} is already paid on-chain. Database status synced.`);
        return;
      }
      if (onChainStatus !== "submitted") {
        setStatus(
          `Cannot sync payment. On-chain milestone ${index} is ${onChainStatus || "unknown"}, but payment release requires Submitted.`
        );
        return;
      }

      const milestoneAmount = Number(milestone.amount || 0);
      const escrowBalance = toNumber(
        await contracts.getEscrowBalanceOnChain(selectedJob.job_hash)
      );
      if (escrowBalance < milestoneAmount) {
        await contracts.depositEscrowOnChain(
          selectedJob.job_hash,
          address,
          milestoneAmount - escrowBalance
        );
      }

      await contracts.approveMilestoneOnChain(
        selectedJob.job_hash,
        index,
        normalizeWallet(address)
      );
      setStatus(`Synced on-chain payment for milestone ${milestone.milestone_id}.`);
    } catch (error) {
      setStatus(`Payment sync failed: ${error.message}`);
    }
  };

  const fundSelectedEscrow = async () => {
    if (!address || !selectedJob) {
      setStatus("Load a job and connect the client wallet first.");
      return;
    }

    const totalAmount = getMilestoneTotal(selectedMilestones);
    if (totalAmount <= 0) {
      setStatus("Cannot fund escrow because this job has no milestone amount.");
      return;
    }

    try {
      const currentBalance = toNumber(
        await contracts.getEscrowBalanceOnChain(selectedJob.job_hash)
      );
      if (currentBalance >= totalAmount) {
        setStatus(`Escrow already has ${currentBalance.toLocaleString()} for job ${selectedJob.job_id}.`);
        return;
      }

      const txResult = await contracts.depositEscrowOnChain(
        selectedJob.job_hash,
        address,
        totalAmount - currentBalance
      );
      setTxHash(txResult.hash);
      setStatus(`Escrow funded for job ${selectedJob.job_id}. You can approve submitted milestones now.`);
    } catch (error) {
      const message = error.message.includes("job already funded")
        ? "Escrow is already funded for this job."
        : `Escrow funding failed: ${error.message}`;
      setStatus(message);
    }
  };

  const browse = async () => {
    setStatus("");
    try {
      const result = await api.getFreelancers(category);
      setFreelancers(result.freelancers || []);
      if (!result.freelancers?.length) {
        setStatus("No freelancers found for this category.");
      }
    } catch (error) {
      setStatus(`Search failed: ${error.message}`);
    }
  };

  const useFreelancer = (freelancer) => {
    setFreelancerWallet(freelancer.wallet_address);
    setStatus(`Selected freelancer ${freelancer.wallet_address}.`);
  };

  const addMilestone = () =>
    setMilestones((prev) => {
      const next = [...prev, emptyMilestone()];
      const percentages = distributePercentages(next.length);
      return next.map((milestone, idx) => ({
        ...milestone,
        percentage: percentages[idx]
      }));
    });

  const updateMilestone = (idx, key, value) => {
    setMilestones((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m))
    );
  };

  const createJob = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      let profile;
      try {
        const result = await api.getProfile(address);
        profile = result.profile;
      } catch (_error) {
        setStatus("Please register on the Role page before creating jobs.");
        return;
      }
      if (!hasRole(profile, "client")) {
        setStatus("Add a Client identity on the Role page before creating jobs.");
        return;
      }

      const normalizedFreelancerWallet = freelancerWallet
        ? normalizeWallet(freelancerWallet)
        : "";

      const parsedMilestones = milestones.map((m) => ({
        ...m,
        percentage: Number(m.percentage),
        amount: Number(m.amount),
        deadlineTs: Math.floor(new Date(m.deadline).getTime() / 1000)
      }));

      if (parsedMilestones.some((m) => !Number.isFinite(m.percentage) || m.percentage <= 0)) {
        setStatus("Each milestone percentage must be a positive number.");
        return;
      }

      const percentageSum = parsedMilestones.reduce(
        (sum, m) => sum + m.percentage,
        0
      );
      if (percentageSum !== 100) {
        setStatus(`Milestone percentages must sum to 100. Current: ${percentageSum}`);
        return;
      }

      if (
        parsedMilestones.some(
          (m) => !Number.isFinite(m.amount) || m.amount <= 0 || !Number.isFinite(m.deadlineTs)
        )
      ) {
        setStatus("Each milestone must have a valid positive amount and deadline.");
        return;
      }

      const payload = {
        client_wallet: normalizeWallet(address),
        freelancer_wallet: normalizedFreelancerWallet || null,
        title,
        description,
        milestones
      };
      const result = await api.createJob(payload);

      const milestoneHashes = await Promise.all(
        parsedMilestones.map((m) =>
          sha256Hex(
            JSON.stringify({
              name: m.name,
              percentage: m.percentage,
              deadline: m.deadline
            })
          )
        )
      );

      try {
        const totalAmount = parsedMilestones.reduce((sum, m) => sum + m.amount, 0);

        // Step 1: Create job on JobManager (no milestones)
        await contracts.createJobOnChain({
          jobIdHex: result.job.job_hash,
          jobHashHex: result.job.job_hash,
          clientAddress: address,
          totalAmount,
        });

        // Step 2: Deposit escrow
        const txResult = await contracts.depositEscrowOnChain(
          result.job.job_hash,
          address,
          totalAmount
        );

        // Step 3: Register milestones on MilestoneManager
        // If there's a freelancer assigned, use their address; otherwise use a placeholder
        // (milestones will be updated when freelancer accepts)
        const freelancerAddr = normalizedFreelancerWallet || address;
        await contracts.addMilestonesOnChain({
          jobIdHex: result.job.job_hash,
          clientAddress: address,
          freelancerAddress: freelancerAddr,
          totalAmount,
          milestoneHashesHex: milestoneHashes,
          milestonePercentages: parsedMilestones.map((m) => m.percentage),
          milestoneDeadlines: parsedMilestones.map((m) => m.deadlineTs),
        });
        
        setTxHash(txResult.hash);
        setStatus(`Job created on-chain, escrow funded, and milestones registered. DB Job ID: ${result.job.job_id}`);
      } catch (contractError) {
        console.error("DETAILED CONTRACT ERROR:", contractError);
        const contractMessage = contractError.message.includes("VITE_JOB_MANAGER_CONTRACT_ID")
          ? "Job Manager contract ID is not configured."
          : contractError.message.includes("VITE_MILESTONE_MANAGER_CONTRACT_ID")
          ? "Milestone Manager contract ID is not configured."
          : contractError.message;
        setStatus(
          `Job created in database. On-chain setup incomplete: ${contractMessage}`
        );
      }
    } catch (error) {
      setStatus(`Create failed: ${error.message}`);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Client Dashboard</h2>
        <p className="subtitle">Search freelancers, monitor milestones, and release escrow payments on-chain.</p>
      </div>

      {/* SECTION 1: SEARCH & BROWSE TALENT */}
      <section className="dashboard-section">
        <header className="section-header">
          <span className="section-badge">01</span>
          <h3>Find Freelancers</h3>
        </header>

        <div className="card">
          <h3>Browse Freelancers by Category</h3>
          <div className="row-actions">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. react, node, solidity"
            />
            <button onClick={browse}>Search</button>
          </div>
        </div>

        {freelancers.length === 0 ? (
          <EmptyState
            iconType="search"
            title="Browse Qualified Talent"
            message="Search for skilled freelancers on-chain by entering a programming language, framework, or skillset category above."
          />
        ) : (
          <div className="grid-cards" style={{ marginTop: "1rem" }}>
            {freelancers.map((freelancer) => (
              <FreelancerCard
                key={freelancer.wallet_address}
                freelancer={freelancer}
                onSelect={useFreelancer}
              />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: MANAGE ACTIVE JOBS */}
      <section className="dashboard-section">
        <header className="section-header">
          <span className="section-badge">02</span>
          <h3>Manage Jobs &amp; Escrow</h3>
        </header>

        <div className="card">
          <h3>Your Previous Jobs</h3>
          {myJobs.length === 0 ? (
            <EmptyState
              iconType="jobs"
              title="No Jobs Loaded"
              message="Load your previous jobs from the database to manage milestones, release payouts, and sync transactions."
              action={<button onClick={loadMyJobs} style={{ marginTop: "1rem" }}>Load Previous Jobs</button>}
            />
          ) : (
            <div className="grid-cards" style={{ marginTop: "1rem" }}>
              {myJobs.map((j) => (
                <JobCard
                  key={j.job_id}
                  job={j}
                  onSelect={selectJob}
                  isSelected={selectedJob?.job_id === j.job_id}
                />
              ))}
            </div>
          )}
        </div>

        {selectedJob && (
          <div className="card review-milestones-card" ref={reviewRef} style={{ marginTop: "1rem" }}>
            <div className="section-heading">
              <h3>Review Job #{selectedJob.job_id}</h3>
              <span>{selectedMilestones.length} milestones</span>
            </div>
            <div className="row-actions">
              <button className="ghost" onClick={fundSelectedEscrow}>
                Fund Escrow
              </button>
              <span className="inline-muted" style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--text)" }}>
                Total Budget: {getMilestoneTotal(selectedMilestones).toLocaleString()} XLM
              </span>
            </div>
            <div className="milestone-payment-list">
              {selectedMilestones.map((milestone, idx) => (
                <div className="payment-row milestone-payment-row" key={milestone.milestone_id}>
                  <div className="milestone-payment-copy">
                    <strong style={{ fontSize: "1.1rem", color: "var(--text)" }}>#{idx + 1} - {milestone.name}</strong>
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      Status: <span style={{ fontWeight: 600, color: milestone.status === "approved" || milestone.status === "paid" ? "var(--crayon-green)" : milestone.status === "submitted" ? "var(--crayon-blue)" : "var(--crayon-orange)" }}>{milestone.status}</span>
                      {" "}·{" "}
                      <strong>{Number(milestone.amount).toLocaleString()} XLM</strong>
                    </span>
                  </div>
                  {milestone.status === "submitted" ? (
                    <button onClick={() => approveMilestone(milestone)}>
                      Approve &amp; Pay
                    </button>
                  ) : milestone.status === "approved" ? (
                    <div className="row-actions">
                      <span className="status-pill status-pill-completed">
                        approved
                      </span>
                      <button className="ghost" onClick={() => syncApprovedPaymentOnChain(milestone)}>
                        Sync Payment
                      </button>
                    </div>
                  ) : (
                    <span className={`status-pill ${milestone.status === "approved" ? "status-pill-completed" : "status-pill-assigned"}`}>
                      {milestone.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: POST A NEW JOB */}
      <section className="dashboard-section">
        <header className="section-header">
          <span className="section-badge">03</span>
          <h3>Post a New Job</h3>
        </header>

        <form className="grid-form" onSubmit={createJob} style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent" }}>
          <h3>Create Job with Milestones</h3>
          <div className="wallet-field-row">
            <label style={{ flex: 1, marginBottom: 0 }}>
              Freelancer Wallet (optional)
              <input
                value={freelancerWallet}
                onChange={(e) => setFreelancerWallet(e.target.value)}
                placeholder="Leave empty to create an open job..."
              />
            </label>
            {freelancerWallet && (
              <button
                type="button"
                className="ghost"
                onClick={() => setFreelancerWallet("")}
                style={{ height: "50px", padding: "0 1.5rem", whiteSpace: "nowrap" }}
              >
                Clear Selection
              </button>
            )}
          </div>
          <span className="inline-muted" style={{ display: "block", marginBottom: "1.5rem", marginTop: "0.5rem" }}>
            Leave the wallet field empty to create an "Open Job" that any freelancer can accept later.
          </span>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>
          <p className="milestone-help" style={{ marginTop: "1rem", marginBottom: "0.5rem", opacity: 0.8 }}>
            Percentages across all milestones must total 100. Amount should match the payout for each milestone.
          </p>
          <div className="milestones-table-container">
            <div className="milestone-row milestone-header" aria-hidden="true">
              <span>Milestone Name</span>
              <span>Percentage (%)</span>
              <span>Amount</span>
              <span>Deadline</span>
            </div>
            {milestones.map((m, idx) => (
              <div className="milestone-row" key={`milestone-${idx}`}>
                <input
                  placeholder="Milestone name"
                  value={m.name}
                  onChange={(e) => updateMilestone(idx, "name", e.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Percentage"
                  value={m.percentage}
                  onChange={(e) =>
                    updateMilestone(idx, "percentage", Number(e.target.value))
                  }
                  required
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={m.amount}
                  onChange={(e) => updateMilestone(idx, "amount", Number(e.target.value))}
                  required
                />
                <input
                  type="date"
                  value={m.deadline}
                  onChange={(e) => updateMilestone(idx, "deadline", e.target.value)}
                  required
                />
              </div>
            ))}
          </div>
          <div className="row-actions">
            <button type="button" className="ghost" onClick={addMilestone}>
              + Add Milestone
            </button>
            <button type="submit">Create Job</button>
          </div>
        </form>
      </section>

      {status && (
        <div className="status-modal-overlay" onClick={handleDismiss}>
          <div className="status-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={`status-icon ${getStatusType(status)}`}>
              {getStatusType(status) === "success" && "✓"}
              {getStatusType(status) === "error" && "✗"}
              {getStatusType(status) === "info" && "ℹ"}
            </div>
            
            <h4>
              {getStatusType(status) === "success" && "Success!"}
              {getStatusType(status) === "error" && "Error / Action Required"}
              {getStatusType(status) === "info" && "Notice"}
            </h4>
            
            <p className="status-message">{status}</p>
            
            {txHash && (
              <div className="tx-wrapper">
                <span>Transaction Hash:</span>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-link-btn"
                >
                  View on Stellar Expert ↗
                </a>
              </div>
            )}
            
            <button className="status-close-btn" onClick={handleDismiss}>
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
