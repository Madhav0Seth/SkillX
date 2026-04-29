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
  const [status, setStatus] = useState("");

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
      const payload = {
        client_wallet: address,
        freelancer_wallet: freelancerWallet || null,
        title,
        description,
        milestones
      };
      const result = await api.createJob(payload);

      const milestoneHashes = await Promise.all(
        milestones.map((m) =>
          sha256Hex(
            JSON.stringify({
              name: m.name,
              percentage: Number(m.percentage),
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
        totalAmount: milestones.reduce((sum, m) => sum + Number(m.amount || 0), 0),
        milestoneHashesHex: milestoneHashes,
        milestonePercentages: milestones.map((m) => Number(m.percentage)),
        milestoneDeadlines: milestones.map((m) =>
          Math.floor(new Date(m.deadline).getTime() / 1000)
        )
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
