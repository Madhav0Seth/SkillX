import { useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";

export default function FreelancerDashboard() {
  const { address } = useWallet();
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [rejectedJobIds, setRejectedJobIds] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [milestoneId, setMilestoneId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState("");

  const loadJobs = async () => {
    setStatus("");
    try {
      const result = await api.getJobs({
        freelancer_wallet: address || undefined,
        limit: 20
      });
      const filteredJobs = (result.jobs || []).filter(
        (item) =>
          item.client_wallet !== address &&
          !rejectedJobIds.includes(item.job_id)
      );
      setJobs(filteredJobs);
      if (!filteredJobs.length) {
        setStatus("No job requests found yet.");
      }
    } catch (error) {
      setStatus(`Jobs fetch failed: ${error.message}`);
    }
  };

  const loadJob = async () => {
    if (!jobId) return;
    setStatus("");
    try {
      const result = await api.getJob(jobId);
      setJob(result.job);
      setMilestones(result.milestones || []);
      setStatus(`Loaded job ${result.job.job_id}.`);
    } catch (error) {
      setStatus(`Load failed: ${error.message}`);
      setJob(null);
      setMilestones([]);
    }
  };

  const selectJob = async (selectedJob) => {
    setJobId(String(selectedJob.job_id));
    setStatus("");
    try {
      const result = await api.getJob(selectedJob.job_id);
      setJob(result.job);
      setMilestones(result.milestones || []);
      setStatus(`Selected job ${result.job.job_id}.`);
    } catch (error) {
      setStatus(`Select failed: ${error.message}`);
    }
  };

  const acceptJob = async (selectedJob) => {
    try {
      if (selectedJob.client_wallet === address) {
        setStatus("You cannot accept your own job. Use a different freelancer wallet.");
        return;
      }
      await api.acceptJob(selectedJob.job_id, address);
      await contracts.acceptJobOnChain(selectedJob.job_hash, address);
      setStatus(`Accepted job ${selectedJob.job_id}.`);
      await selectJob(selectedJob);
      setJobs((prev) =>
        prev.map((item) =>
          item.job_id === selectedJob.job_id
            ? { ...item, freelancer_wallet: address }
            : item
        )
      );
    } catch (error) {
      setStatus(`Accept failed: ${error.message}`);
    }
  };

  const rejectJob = async (selectedJob) => {
    try {
      await api.rejectJob(selectedJob.job_id, address);
      setStatus(`Rejected job ${selectedJob.job_id}.`);
      setRejectedJobIds((prev) => [...prev, selectedJob.job_id]);
      setJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      if (job && job.job_id === selectedJob.job_id) {
        setJob(null);
        setMilestones([]);
        setMilestoneId("");
      }
    } catch (error) {
      setStatus(`Reject failed: ${error.message}`);
    }
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
      const index = milestones.findIndex(
        (m) => Number(m.milestone_id) === Number(milestoneId)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }
      await contracts.submitMilestoneOnChain(
        job?.job_hash || "",
        index
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
          <button onClick={loadJobs}>Load My Job Requests</button>
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Enter job ID"
          />
          <button onClick={loadJob}>Load Job</button>
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="grid-cards">
          {jobs.map((item) => (
            <JobCard
              key={item.job_id}
              job={item}
              onSelect={selectJob}
              isSelected={job?.job_id === item.job_id}
              onAccept={acceptJob}
              onReject={rejectJob}
            />
          ))}
        </div>
      )}

      {job && <JobCard job={job} onAccept={acceptJob} onReject={rejectJob} />}

      {milestones.length > 0 && (
        <div className="card">
          <h3>Milestones for loaded job</h3>
          {milestones.map((m, idx) => (
            <small key={m.milestone_id}>
              #{idx} - Milestone ID {m.milestone_id}: {m.name} ({m.status})
            </small>
          ))}
        </div>
      )}

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
