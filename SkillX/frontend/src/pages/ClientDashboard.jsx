import { useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import FreelancerCard from "../components/FreelancerCard";

function emptyMilestone() {
  return {
    name: "",
    percentage: 0,
    amount: 0,
    deadline: ""
  };
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ClientDashboard() {
  const { address } = useWallet();
  const [category, setCategory] = useState("");
  const [freelancers, setFreelancers] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freelancerWallet, setFreelancerWallet] = useState("");
  const [milestones, setMilestones] = useState([emptyMilestone()]);
  const [myJobs, setMyJobs] = useState([]);
  const [status, setStatus] = useState("");

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

  const addMilestone = () => setMilestones((prev) => [...prev, emptyMilestone()]);

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
      if (freelancerWallet && freelancerWallet === address) {
        setStatus("Client and freelancer cannot be the same wallet.");
        return;
      }

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
        client_wallet: address,
        freelancer_wallet: freelancerWallet || null,
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

      await contracts.createJobOnChain({
        // Temporary mapping: use backend job_hash as deterministic on-chain job_id.
        jobIdHex: result.job.job_hash,
        jobHashHex: result.job.job_hash,
        clientAddress: address,
        totalAmount: parsedMilestones.reduce((sum, m) => sum + m.amount, 0),
        milestoneHashesHex: milestoneHashes,
        milestonePercentages: parsedMilestones.map((m) => m.percentage),
        milestoneDeadlines: parsedMilestones.map((m) => m.deadlineTs)
      });

      setStatus(`Job created and sent on-chain. DB Job ID: ${result.job.job_id}`);
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
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="grid-cards">
        {freelancers.map((freelancer) => (
          <FreelancerCard
            key={freelancer.wallet_address}
            freelancer={freelancer}
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
          <div className="milestone-row" key={`${idx}-${m.name}`}>
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
    </section>
  );
}
