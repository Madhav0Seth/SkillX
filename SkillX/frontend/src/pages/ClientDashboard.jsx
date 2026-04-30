import { useRef, useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import FreelancerCard from "../components/FreelancerCard";
import { getMilestoneStatus } from "../utils/contractStatus";

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

        await contracts.createJobOnChain({
          // Temporary mapping: use backend job_hash as deterministic on-chain job_id.
          jobIdHex: result.job.job_hash,
          jobHashHex: result.job.job_hash,
          clientAddress: address,
          totalAmount,
          milestoneHashesHex: milestoneHashes,
          milestonePercentages: parsedMilestones.map((m) => m.percentage),
          milestoneDeadlines: parsedMilestones.map((m) => m.deadlineTs)
        });

        const txResult = await contracts.depositEscrowOnChain(
          result.job.job_hash,
          address,
          totalAmount
        );
        
        setTxHash(txResult.hash);
        setStatus(`Job created on-chain and escrow funded. DB Job ID: ${result.job.job_id}`);
      } catch (contractError) {
        const contractMessage = contractError.message.includes("VITE_JOB_MANAGER_CONTRACT_ID")
          ? "Job Manager contract ID is not configured."
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
    <section>
      <h2>Client Dashboard</h2>

      <div className="card">
        <h3>Browse Freelancers by Category</h3>
        <div className="row-actions">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="react"
          />
          <button onClick={browse}>Search</button>
        </div>
      </div>

      <div className="card">
        <h3>Your Previous Jobs</h3>
        <div className="row-actions">
          <button onClick={loadMyJobs}>Load Previous Jobs</button>
        </div>
        {myJobs.length > 0 && (
          <div className="grid-cards">
            {myJobs.map((j) => (
              <article className="card" key={j.job_id}>
                <h4>{j.title}</h4>
                <small>Job ID: {j.job_id}</small>
                <small>Freelancer: {j.freelancer_wallet || "Unassigned"}</small>
                <small>Created: {new Date(j.created_at).toLocaleString()}</small>
                <button className="ghost" onClick={() => selectJob(j)}>
                  Review Milestones
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <div className="card review-milestones-card" ref={reviewRef}>
          <div className="section-heading">
            <h3>Review Job #{selectedJob.job_id}</h3>
            <span>{selectedMilestones.length} milestones</span>
          </div>
          <div className="row-actions">
            <button className="ghost" onClick={fundSelectedEscrow}>
              Fund Escrow
            </button>
            <span className="inline-muted">
              Total: {getMilestoneTotal(selectedMilestones).toLocaleString()}
            </span>
          </div>
          {selectedMilestones.map((milestone, idx) => (
            <div className="payment-row" key={milestone.milestone_id}>
              <div>
                <strong>#{idx} - {milestone.name}</strong>
                <small>{milestone.status} · {Number(milestone.amount).toLocaleString()} total</small>
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
      )}

      <div className="grid-cards">
        {freelancers.map((freelancer) => (
          <FreelancerCard
            key={freelancer.wallet_address}
            freelancer={freelancer}
            onSelect={useFreelancer}
          />
        ))}
      </div>

      <form className="grid-form" onSubmit={createJob}>
        <h3>Create Job with Milestones</h3>
        <label>
          Freelancer Wallet (optional)
          <input
            value={freelancerWallet}
            onChange={(e) => setFreelancerWallet(e.target.value)}
          />
        </label>
        <div className="row-actions">
          <button type="button" className="ghost" onClick={() => setFreelancerWallet("")}>
            Create Open Job
          </button>
          <span className="inline-muted">
            Leave freelancer empty unless you selected a registered freelancer above.
          </span>
        </div>
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
        <div className="milestone-row milestone-header" aria-hidden="true">
          <span>Milestone Name</span>
          <span>Percentage (%)</span>
          <span>Amount</span>
          <span>Deadline</span>
        </div>
        <p className="milestone-help">
          Percentages across all milestones must total 100. Amount should match the payout for each milestone.
        </p>
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
        <div className="row-actions">
          <button type="button" className="ghost" onClick={addMilestone}>
            + Add Milestone
          </button>
          <button type="submit">Create Job</button>
        </div>
      </form>
      {status && <p className="status">{status}</p>}
      {txHash && (
        <p className="status">
          Transaction Hash:{" "}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--primary)", textDecoration: "underline" }}
          >
            {txHash.slice(0, 12)}...{txHash.slice(-12)}
          </a>
        </p>
      )}
    </section>
  );
}
