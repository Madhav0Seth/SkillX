import { useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";

export default function FreelancerDashboard() {
  const { address } = useWallet();
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const [milestoneId, setMilestoneId] = useState("");
  const [milestoneIndex, setMilestoneIndex] = useState("0");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState("");

  const loadJob = async () => {
    if (!jobId) return;
    setStatus("");
    try {
      const result = await api.getJob(jobId);
      setJob(result.job);
      setStatus(`Loaded job ${result.job.job_id}.`);
    } catch (error) {
      setStatus(`Load failed: ${error.message}`);
      setJob(null);
    }
  };

  const acceptJob = async (selectedJob) => {
    try {
      await contracts.acceptJobOnChain(selectedJob.job_hash, address);
      setStatus(`Accepted job ${selectedJob.job_id} on-chain.`);
    } catch (error) {
      setStatus(`Accept failed: ${error.message}`);
    }
  };

  const rejectJob = (selectedJob) => {
    setStatus(`Rejected job ${selectedJob.job_id}.`);
  };

  const submitMilestone = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      await api.submitMilestone({
        milestone_id: Number(milestoneId),
        file_url: fileUrl
      });
      await contracts.submitMilestoneOnChain(
        job?.job_hash || "",
        Math.max(0, Number(milestoneIndex))
      );
      setStatus(`Submitted milestone ${milestoneId}.`);
    } catch (error) {
      setStatus(`Submit failed: ${error.message}`);
    }
  };

  return (
    <section>
      <h2>Freelancer Dashboard</h2>
      <div className="card">
        <h3>View Job Requests</h3>
        <div className="row-actions">
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Enter job ID"
          />
          <button onClick={loadJob}>Load Job</button>
        </div>
      </div>

      {job && <JobCard job={job} onAccept={acceptJob} onReject={rejectJob} />}

      <form className="grid-form" onSubmit={submitMilestone}>
        <h3>Submit Milestone</h3>
        <label>
          Milestone ID
          <input
            type="number"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            required
          />
        </label>
        <label>
          Milestone Index (on-chain, zero-based)
          <input
            type="number"
            min="0"
            value={milestoneIndex}
            onChange={(e) => setMilestoneIndex(e.target.value)}
            required
          />
        </label>
        <label>
          Submission URL
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://files.example/submission.zip"
            required
          />
        </label>
        <button type="submit">Submit Milestone</button>
      </form>
      {status && <p className="status">{status}</p>}
    </section>
  );
}
