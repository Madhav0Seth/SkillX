import { useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";

function canSubmitMilestone(milestones, idx) {
  const milestone = milestones[idx];
  if (!milestone || milestone.status !== "pending") {
    return false;
  }
  return milestones
    .slice(0, idx)
    .every((previous) => previous.status === "approved");
}

function getMilestoneBlockedReason(milestones, idx) {
  const milestone = milestones[idx];
  if (!milestone) {
    return "Selected milestone is not part of the loaded job.";
  }
  if (milestone.status !== "pending") {
    return `Milestone ${idx} is already ${milestone.status}.`;
  }
  const previousUnpaidIndex = milestones
    .slice(0, idx)
    .findIndex((previous) => previous.status !== "approved");
  if (previousUnpaidIndex >= 0) {
    return `Submit milestones in order. Milestone ${previousUnpaidIndex} must be approved and paid before milestone ${idx}.`;
  }
  return "";
}

function getFirstSubmittableMilestoneId(milestones) {
  const milestone = milestones.find((item, idx) =>
    canSubmitMilestone(milestones, idx)
  );
  return milestone ? String(milestone.milestone_id) : "";
}

export default function FreelancerDashboard() {
  const { address } = useWallet();
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [openJobs, setOpenJobs] = useState([]);
  const [rejectedJobIds, setRejectedJobIds] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [milestoneId, setMilestoneId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState("");

  const loadMyJobs = async () => {
    setStatus("");
    if (!address) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      const result = await api.getJobs({
        freelancer_wallet: address,
        scope: "assigned",
        limit: 20
      });
      const myJobs = (result.jobs || []).filter((item) => item.client_wallet !== address);
      setAssignedJobs(myJobs);
      if (!myJobs.length) {
        setStatus("No jobs are assigned to your wallet yet.");
      }
    } catch (error) {
      setStatus(`My jobs fetch failed: ${error.message}`);
    }
  };

  const loadOpenJobs = async () => {
    setStatus("");
    try {
      const result = await api.getJobs({
        freelancer_wallet: address || undefined,
        scope: "open",
        limit: 30
      });
      const availableJobs = (result.jobs || []).filter(
        (item) => item.client_wallet !== address && !rejectedJobIds.includes(item.job_id)
      );
      setOpenJobs(availableJobs);
      if (!availableJobs.length) {
        setStatus("No open jobs found yet.");
      }
    } catch (error) {
      setStatus(`Open jobs fetch failed: ${error.message}`);
    }
  };

  const loadJob = async () => {
    if (!jobId) return;
    setStatus("");
    try {
      const result = await api.getJob(jobId);
      setJob(result.job);
      setMilestones(result.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(result.milestones || []));
      setStatus(`Loaded job ${result.job.job_id}.`);
    } catch (error) {
      setStatus(`Load failed: ${error.message}`);
      setJob(null);
      setMilestones([]);
    }
  };

  const selectJob = async (selectedJob, options = {}) => {
    setJobId(String(selectedJob.job_id));
    if (!options.keepStatus) {
      setStatus("");
    }
    try {
      const result = await api.getJob(selectedJob.job_id);
      setJob(result.job);
      setMilestones(result.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(result.milestones || []));
      if (!options.keepStatus) {
        setStatus(`Selected job ${result.job.job_id}.`);
      }
    } catch (error) {
      setStatus(`Select failed: ${error.message}`);
    }
  };

  const acceptJob = async (selectedJob) => {
    try {
      if (!address) {
        setStatus("Connect wallet first.");
        return;
      }
      try {
        await api.getProfile(address);
      } catch (_error) {
        setStatus("Please register on the Role page before accepting jobs.");
        return;
      }

      if (selectedJob.client_wallet === address) {
        setStatus("You cannot accept your own job. Use a different freelancer wallet.");
        return;
      }
      const acceptedResult = await api.acceptJob(selectedJob.job_id, address);
      let acceptedStatus = `Accepted job ${selectedJob.job_id}.`;
      try {
        await contracts.acceptJobOnChain(selectedJob.job_hash, address);
      } catch (contractError) {
        acceptedStatus =
          `Accepted job ${selectedJob.job_id} in database. On-chain accept skipped: ${contractError.message}`;
      }
      setStatus(acceptedStatus);
      await selectJob(acceptedResult.job, { keepStatus: true });
      setOpenJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      setAssignedJobs((prev) =>
        prev.some((item) => item.job_id === selectedJob.job_id)
          ? prev.map((item) =>
              item.job_id === selectedJob.job_id
                ? acceptedResult.job
                : item
            )
          : [acceptedResult.job, ...prev]
      );
    } catch (error) {
      setStatus(`Accept failed: ${error.message}`);
    }
  };

  const rejectJob = async (selectedJob) => {
    try {
      if (!address) {
        setStatus("Connect wallet first.");
        return;
      }
      await api.rejectJob(selectedJob.job_id, address);
      setStatus(`Rejected job ${selectedJob.job_id}.`);
      setRejectedJobIds((prev) => [...prev, selectedJob.job_id]);
      setOpenJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      setAssignedJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
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
      if (!job) {
        setStatus("Load and select a job before submitting a milestone.");
        return;
      }
      if (job.freelancer_wallet !== address) {
        setStatus("Only the assigned freelancer can submit milestones for this job.");
        return;
      }
      const index = milestones.findIndex(
        (m) => Number(m.milestone_id) === Number(milestoneId)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }
      const blockedReason = getMilestoneBlockedReason(milestones, index);
      if (blockedReason) {
        setStatus(blockedReason);
        return;
      }
      await contracts.submitMilestoneOnChain(
        job?.job_hash || "",
        index
      );
      await api.submitMilestone({
        milestone_id: Number(milestoneId),
        file_url: fileUrl
      });
      const refreshed = await api.getJob(job.job_id);
      setMilestones(refreshed.milestones || []);
      setJob(refreshed.job);
      setMilestoneId(getFirstSubmittableMilestoneId(refreshed.milestones || []));
      setFileUrl("");
      setStatus(`Submitted milestone ${milestoneId}.`);
    } catch (error) {
      const message = error.message.includes("InvalidAction")
        ? "Submit failed on-chain. Check that this job was created and accepted on-chain, and submit milestones in order after previous approval/payment."
        : `Submit failed: ${error.message}`;
      setStatus(message);
    }
  };

  return (
    <section>
      <h2>Freelancer Dashboard</h2>
      <div className="card">
        <h3>Jobs</h3>
        <div className="row-actions">
          <button onClick={loadMyJobs}>View My Jobs</button>
          <button className="ghost" onClick={loadOpenJobs}>View Open Jobs</button>
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Enter job ID"
          />
          <button onClick={loadJob}>Load Job</button>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Assigned to Me</h3>
          <span>{assignedJobs.length} jobs</span>
        </div>
        {assignedJobs.length > 0 ? (
          <div className="grid-cards">
            {assignedJobs.map((item) => (
              <JobCard
                key={item.job_id}
                job={item}
                onSelect={selectJob}
                isSelected={job?.job_id === item.job_id}
                onReject={rejectJob}
                variant="assigned"
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">Use View My Jobs to load jobs assigned to your wallet.</p>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-heading">
          <h3>Open Jobs</h3>
          <span>{openJobs.length} jobs</span>
        </div>
        {openJobs.length > 0 ? (
          <div className="grid-cards">
            {openJobs.map((item) => (
              <JobCard
                key={item.job_id}
                job={item}
                onSelect={selectJob}
                isSelected={job?.job_id === item.job_id}
                onAccept={acceptJob}
                onReject={rejectJob}
                variant="open"
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">Use View Open Jobs to browse jobs without an assigned freelancer.</p>
        )}
      </div>

      {job && (
        <div className="dashboard-section">
          <div className="section-heading">
            <h3>Selected Job</h3>
            <span>Job #{job.job_id}</span>
          </div>
          <JobCard
            job={job}
            onAccept={job.freelancer_wallet ? undefined : acceptJob}
            onReject={rejectJob}
            isSelected
          />
        </div>
      )}

      {milestones.length > 0 && (
        <div className="card">
          <h3>Milestones for loaded job</h3>
          {milestones.map((m, idx) => (
            <small key={m.milestone_id}>
              #{idx} - Milestone ID {m.milestone_id}: {m.name} ({m.status})
              {canSubmitMilestone(milestones, idx) ? " - ready to submit" : ""}
            </small>
          ))}
        </div>
      )}

      {job && job.freelancer_wallet === address && (
        <form className="grid-form" onSubmit={submitMilestone}>
          <h3>Submit Completed Milestone</h3>
          <label>
            Completed milestone
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              required
            >
              <option value="">Select milestone</option>
              {milestones.map((m, idx) => (
                <option
                  key={m.milestone_id}
                  value={m.milestone_id}
                  disabled={!canSubmitMilestone(milestones, idx)}
                >
                  #{idx} - {m.name} ({m.status})
                </option>
              ))}
            </select>
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
          <button type="submit" disabled={!milestoneId}>
            Submit Milestone
          </button>
          {!milestoneId && (
            <p className="empty-state">
              No milestone is ready to submit yet. Submit milestone 0 first, then wait for approval before continuing.
            </p>
          )}
        </form>
      )}
      {status && <p className="status">{status}</p>}
    </section>
  );
}
