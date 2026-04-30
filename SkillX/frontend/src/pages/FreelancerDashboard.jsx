import { useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";
import { getJobStatus, getMilestoneStatus } from "../utils/contractStatus";

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
    const previousStatus = milestones[previousUnpaidIndex]?.status;
    if (previousStatus === "submitted") {
      return `Milestone ${previousUnpaidIndex} is submitted and waiting for client approval/payment before milestone ${idx} can start.`;
    }
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

function getSubmissionHint(milestones = []) {
  if (!milestones.length) {
    return "No milestones are loaded for this job yet.";
  }
  if (isCompletedMilestoneSet(milestones)) {
    return "All milestones are approved and paid.";
  }
  const submittedIndex = milestones.findIndex((item) => item.status === "submitted");
  if (submittedIndex >= 0) {
    return `Milestone ${submittedIndex} is submitted and waiting for client approval/payment. The next milestone unlocks after that payment is released.`;
  }
  const blockedIndex = milestones.findIndex(
    (item, idx) => item.status === "pending" && !canSubmitMilestone(milestones, idx)
  );
  if (blockedIndex >= 0) {
    const previousIndex = milestones
      .slice(0, blockedIndex)
      .findIndex((item) => item.status !== "approved");
    return `Milestone ${blockedIndex} unlocks after milestone ${previousIndex} is approved and paid.`;
  }
  return "No milestone is ready to submit yet.";
}

function hasSubmittedMilestone(milestones = []) {
  return milestones.some((item) => item.status === "submitted");
}

function hasRole(profile, role) {
  return profile?.role === role || profile?.role === "both";
}

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

function normalizeChainAddress(value) {
  if (!value) return "";
  if (typeof value === "string") return normalizeWallet(value);
  if (typeof value.address === "string") return normalizeWallet(value.address);
  if (typeof value.publicKey === "string") return normalizeWallet(value.publicKey);
  if (typeof value.toString === "function") return normalizeWallet(value.toString());
  return "";
}

function getAcceptContractMessage(error) {
  const message = error?.message || "Unknown contract error";
  if (
    message.includes("InvalidAction") ||
    message.includes("UnreachableCodeReached")
  ) {
    return "On-chain accept failed. Make sure this job was created on-chain, is still open on-chain, and you are accepting with the freelancer wallet.";
  }
  return message;
}

function getSubmitContractMessage(error) {
  const message = error?.message || "Unknown contract error";
  if (
    message.includes("InvalidAction") ||
    message.includes("UnreachableCodeReached")
  ) {
    return `Submit failed on-chain. I tried to sync acceptance first; if this is milestone 1 or later, the previous milestone must be approved and paid on-chain before continuing. Details: ${message}`;
  }
  return `Submit failed: ${message}`;
}

function isCompletedMilestoneSet(milestones = []) {
  return milestones.length > 0 && milestones.every((item) => item.status === "approved");
}

function upsertJob(list, job) {
  return list.some((item) => item.job_id === job.job_id)
    ? list.map((item) => (item.job_id === job.job_id ? job : item))
    : [job, ...list];
}

function getPaymentTotal(milestones = []) {
  return milestones.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function formatPayment(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function FreelancerDashboard() {
  const { address } = useWallet();
  const walletAddress = normalizeWallet(address);
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [openJobs, setOpenJobs] = useState([]);
  const [rejectedJobIds, setRejectedJobIds] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [milestoneId, setMilestoneId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  const syncPaidMilestonesFromChain = async (nextJob, nextMilestones = []) => {
    if (!nextJob?.job_hash || !nextMilestones.length) {
      return { job: nextJob, milestones: nextMilestones, syncedCount: 0 };
    }

    const syncedMilestoneIds = [];
    await Promise.all(
      nextMilestones.map(async (milestone, index) => {
        if (milestone.status === "approved") {
          return;
        }
        const onChainMilestone = await contracts.getMilestoneOnChain(
          nextJob.job_hash,
          index
        );
        if (getMilestoneStatus(onChainMilestone) === "paid") {
          await api.approveMilestone(
            milestone.milestone_id,
            normalizeWallet(nextJob.client_wallet)
          );
          syncedMilestoneIds.push(milestone.milestone_id);
        }
      })
    );

    if (!syncedMilestoneIds.length) {
      return { job: nextJob, milestones: nextMilestones, syncedCount: 0 };
    }

    const refreshed = await api.getJob(nextJob.job_id);
    return {
      job: refreshed.job,
      milestones: refreshed.milestones || [],
      syncedCount: syncedMilestoneIds.length
    };
  };

  const syncAssignedJobPlacement = (nextJob, nextMilestones = []) => {
    if (normalizeWallet(nextJob?.freelancer_wallet) !== walletAddress) {
      return;
    }

    const hydratedJob = { ...nextJob, milestones: nextMilestones };
    if (isCompletedMilestoneSet(nextMilestones)) {
      setAssignedJobs((prev) =>
        prev.filter((item) => item.job_id !== hydratedJob.job_id)
      );
      setCompletedJobs((prev) => upsertJob(prev, hydratedJob));
      return;
    }

    setCompletedJobs((prev) =>
      prev.filter((item) => item.job_id !== hydratedJob.job_id)
    );
    setAssignedJobs((prev) => upsertJob(prev, hydratedJob));
  };

  const ensureOnChainAccepted = async (selectedJob = job) => {
    if (!selectedJob) {
      throw new Error("Select an assigned job first.");
    }
    if (normalizeWallet(selectedJob.freelancer_wallet) !== walletAddress) {
      throw new Error("Only the assigned freelancer can sync this job on-chain.");
    }

    const freighterAddress = normalizeWallet(await contracts.getConnectedWalletAddress());
    if (freighterAddress !== walletAddress) {
      throw new Error(
        `Freighter is using ${freighterAddress}, but this job is assigned to ${walletAddress}. Switch Freighter accounts and reconnect.`
      );
    }

    const chainJob = await contracts.getJobOnChain(selectedJob.job_hash);
    const chainStatus = getJobStatus(chainJob?.status);
    const chainClient = normalizeChainAddress(chainJob?.client);

    if (chainClient && chainClient === walletAddress) {
      throw new Error(
        "This wallet is the on-chain client for the job, so it cannot accept or submit as freelancer. Use a different freelancer wallet."
      );
    }

    if (chainStatus === "inprogress") {
      return "already-inprogress";
    }
    if (chainStatus === "open") {
      try {
        await contracts.acceptJobOnChain(selectedJob.job_hash, walletAddress);
      } catch (error) {
        if (
          error.message.includes("InvalidAction") ||
          error.message.includes("UnreachableCodeReached")
        ) {
          const refreshedStatus = getJobStatus(
            await contracts.getJobStatusOnChain(selectedJob.job_hash)
          );
          if (refreshedStatus === "inprogress") {
            return "already-inprogress";
          }
        }
        throw error;
      }
      return "accepted";
    }
    throw new Error(
      `Cannot submit because on-chain job status is ${chainStatus || "unknown"}, not InProgress.`
    );
  };

  const loadMyJobs = async () => {
    setStatus("");
    if (!walletAddress) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      const result = await api.getJobs({
        freelancer_wallet: walletAddress,
        scope: "assigned",
        limit: 20
      });
      const hydratedJobs = await Promise.all(
        (result.jobs || []).map(async (item) => {
          const details = await api.getJob(item.job_id);
          const synced = await syncPaidMilestonesFromChain(
            details.job,
            details.milestones || []
          );
          return { ...synced.job, milestones: synced.milestones || [] };
        })
      );
      const active = hydratedJobs.filter(
        (item) => !isCompletedMilestoneSet(item.milestones)
      );
      const completed = hydratedJobs.filter((item) =>
        isCompletedMilestoneSet(item.milestones)
      );
      setAssignedJobs(active);
      setCompletedJobs(completed);
      if (active.length && !job) {
        await selectJob(active[0], { keepStatus: true });
      } else if (completed.length && !job) {
        await selectJob(completed[0], { keepStatus: true });
      }
      if (!hydratedJobs.length) {
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
        freelancer_wallet: walletAddress || undefined,
        scope: "open",
        limit: 30
      });
      const availableJobs = (result.jobs || []).filter(
        (item) =>
          normalizeWallet(item.client_wallet) !== walletAddress &&
          !rejectedJobIds.includes(item.job_id)
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
      const synced = await syncPaidMilestonesFromChain(
        result.job,
        result.milestones || []
      );
      setJob(synced.job);
      setMilestones(synced.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(synced.milestones || []));
      syncAssignedJobPlacement(synced.job, synced.milestones || []);
      setStatus(
        synced.syncedCount
          ? `Loaded job ${synced.job.job_id}. Payment received and synced.`
          : `Loaded job ${synced.job.job_id}.`
      );
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
      const synced = await syncPaidMilestonesFromChain(
        result.job,
        result.milestones || []
      );
      setJob(synced.job);
      setMilestones(synced.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(synced.milestones || []));
      syncAssignedJobPlacement(synced.job, synced.milestones || []);
      if (!options.keepStatus) {
        setStatus(
          synced.syncedCount
            ? `Selected job ${synced.job.job_id}. Payment received and synced.`
            : `Selected job ${synced.job.job_id}.`
        );
      }
    } catch (error) {
      setStatus(`Select failed: ${error.message}`);
    }
  };

  const acceptJob = async (selectedJob) => {
    try {
      if (!walletAddress) {
        setStatus("Connect wallet first.");
        return;
      }
      let profile;
      try {
        const result = await api.getProfile(walletAddress);
        profile = result.profile;
      } catch (_error) {
        setStatus("Please register on the Role page before accepting jobs.");
        return;
      }
      if (!hasRole(profile, "freelancer")) {
        setStatus("Add a Freelancer identity on the Role page before accepting jobs.");
        return;
      }

      if (normalizeWallet(selectedJob.client_wallet) === walletAddress) {
        setStatus("You cannot accept your own job. Use a different freelancer wallet.");
        return;
      }
      try {
        const txResult = await contracts.acceptJobOnChain(selectedJob.job_hash, walletAddress);
        setTxHash(txResult.hash);
      } catch (contractError) {
        setStatus(getAcceptContractMessage(contractError));
        return;
      }
      const acceptedResult = await api.acceptJob(selectedJob.job_id, walletAddress);
      const acceptedStatus = `Accepted job ${selectedJob.job_id}.`;
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
      if (!walletAddress) {
        setStatus("Connect wallet first.");
        return;
      }
      await api.rejectJob(selectedJob.job_id, walletAddress);
      setStatus(`Rejected job ${selectedJob.job_id}.`);
      setRejectedJobIds((prev) => [...prev, selectedJob.job_id]);
      setOpenJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      setAssignedJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      setCompletedJobs((prev) => prev.filter((item) => item.job_id !== selectedJob.job_id));
      if (job && job.job_id === selectedJob.job_id) {
        setJob(null);
        setMilestones([]);
        setMilestoneId("");
      }
    } catch (error) {
      setStatus(`Reject failed: ${error.message}`);
    }
  };

  const syncOnChainAccept = async () => {
    if (!walletAddress) {
      setStatus("Connect wallet first.");
      return;
    }
    if (!job) {
      setStatus("Select an assigned job first.");
      return;
    }
    if (normalizeWallet(job.freelancer_wallet) !== walletAddress) {
      setStatus("Only the assigned freelancer can sync on-chain acceptance for this job.");
      return;
    }

    try {
      const acceptState = await ensureOnChainAccepted(job);
      const refreshed = await api.getJob(job.job_id);
      const synced = await syncPaidMilestonesFromChain(
        refreshed.job,
        refreshed.milestones || []
      );
      setJob(synced.job);
      setMilestones(synced.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(synced.milestones || []));
      syncAssignedJobPlacement(synced.job, synced.milestones || []);
      setStatus(
        synced.syncedCount
          ? "Payment received and synced. This job is now completed."
          : acceptState === "accepted"
          ? "On-chain acceptance synced. You can submit the next ready milestone now."
          : "This job is already accepted on-chain. If the database milestone says submitted but the client sees pending, click Sync Submitted Milestone On-chain."
      );
    } catch (error) {
      const message = error.message.includes("InvalidAction")
        ? `On-chain accept sync failed. The job may already be accepted on-chain, missing on-chain, or not open. Details: ${error.message}`
        : `On-chain accept sync failed: ${error.message}`;
      setStatus(message);
    }
  };

  const syncSubmittedMilestoneOnChain = async () => {
    if (!walletAddress) {
      setStatus("Connect wallet first.");
      return;
    }
    if (!job) {
      setStatus("Select an assigned job first.");
      return;
    }
    if (normalizeWallet(job.freelancer_wallet) !== walletAddress) {
      setStatus("Only the assigned freelancer can sync milestone submission for this job.");
      return;
    }

    const index = milestones.findIndex((item) => item.status === "submitted");
    if (index < 0) {
      setStatus("No submitted database milestone needs on-chain sync.");
      return;
    }

    try {
      const onChainMilestone = await contracts.getMilestoneOnChain(
        job.job_hash,
        index
      );
      const onChainStatus = getMilestoneStatus(onChainMilestone);
      if (onChainStatus === "submitted") {
        setStatus(`Milestone ${index} is already submitted on-chain. Waiting for client approval/payment.`);
        return;
      }
      if (onChainStatus === "paid") {
        await api.approveMilestone(
          milestones[index].milestone_id,
          normalizeWallet(job.client_wallet)
        );
        const refreshed = await api.getJob(job.job_id);
        setJob(refreshed.job);
        setMilestones(refreshed.milestones || []);
        setMilestoneId(getFirstSubmittableMilestoneId(refreshed.milestones || []));
        syncAssignedJobPlacement(refreshed.job, refreshed.milestones || []);
        setStatus("Payment received on-chain. Database synced and job moved to Completed.");
        return;
      }
      await ensureOnChainAccepted(job);
      if (onChainStatus !== "pending") {
        setStatus(
          `Cannot sync submitted milestone ${index}. On-chain status is ${onChainStatus || "unknown"}, but submit requires Pending.`
        );
        return;
      }

      await contracts.submitMilestoneOnChain(job.job_hash, index, walletAddress);
      const refreshed = await api.getJob(job.job_id);
      setJob(refreshed.job);
      setMilestones(refreshed.milestones || []);
      setMilestoneId(getFirstSubmittableMilestoneId(refreshed.milestones || []));
      syncAssignedJobPlacement(refreshed.job, refreshed.milestones || []);
      setStatus(`Synced milestone ${index} submission on-chain. Client can approve and pay now.`);
    } catch (error) {
      setStatus(`Submitted milestone sync failed: ${error.message}`);
    }
  };

  const submitMilestone = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!walletAddress) {
      setStatus("Connect wallet first.");
      return;
    }
    try {
      if (!job) {
        setStatus("Load and select a job before submitting a milestone.");
        return;
      }
      if (normalizeWallet(job.freelancer_wallet) !== walletAddress) {
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
      await ensureOnChainAccepted(job);
      const onChainMilestone = await contracts.getMilestoneOnChain(
        job.job_hash,
        index
      );
      const onChainStatus = getMilestoneStatus(onChainMilestone);
      if (onChainStatus !== "pending") {
        setStatus(
          `Cannot submit milestone ${index}. On-chain status is ${onChainStatus || "unknown"}, but submit requires Pending.`
        );
        return;
      }
      const txResult = await contracts.submitMilestoneOnChain(
        job?.job_hash || "",
        index,
        walletAddress
      );
      setTxHash(txResult.hash);
      await api.submitMilestone({
        milestone_id: Number(milestoneId),
        file_url: fileUrl
      });
      const refreshed = await api.getJob(job.job_id);
      setMilestones(refreshed.milestones || []);
      setJob(refreshed.job);
      setMilestoneId(getFirstSubmittableMilestoneId(refreshed.milestones || []));
      syncAssignedJobPlacement(refreshed.job, refreshed.milestones || []);
      setFileUrl("");
      setStatus(`Submitted milestone ${milestoneId}.`);
    } catch (error) {
      setStatus(getSubmitContractMessage(error));
    }
  };

  const selectedJobCompleted = isCompletedMilestoneSet(milestones);
  const selectedPaymentTotal = getPaymentTotal(milestones);
  const selectedJobNeedsSubmissionSync = hasSubmittedMilestone(milestones);

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

      <div className="freelancer-workspace">
        <div className="job-list-pane">
          <div className="dashboard-section">
            <div className="section-heading">
              <h3>Assigned to Me</h3>
              <span>{assignedJobs.length} jobs</span>
            </div>
            {assignedJobs.length > 0 ? (
              <div className="stacked-list">
                {assignedJobs.map((item) => (
                  <JobCard
                    key={item.job_id}
                    job={item}
                    onSelect={selectJob}
                    isSelected={job?.job_id === item.job_id}
                    onReject={rejectJob}
                    variant="assigned"
                    statusLabel="In Progress"
                    statusTone="assigned"
                  />
                ))}
              </div>
            ) : (
              <p className="empty-state">Use View My Jobs to load jobs assigned to your wallet.</p>
            )}
          </div>

          <div className="dashboard-section">
            <div className="section-heading">
              <h3>Completed</h3>
              <span>{completedJobs.length} jobs</span>
            </div>
            {completedJobs.length > 0 ? (
              <div className="stacked-list">
                {completedJobs.map((item) => (
                  <JobCard
                    key={item.job_id}
                    job={item}
                    onSelect={selectJob}
                    isSelected={job?.job_id === item.job_id}
                    variant="completed"
                    statusLabel="Completed"
                    statusTone="completed"
                    paymentAmount={formatPayment(getPaymentTotal(item.milestones))}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-state">Completed jobs will appear here after every milestone is approved and paid.</p>
            )}
          </div>

          <div className="dashboard-section">
            <div className="section-heading">
              <h3>Open Jobs</h3>
              <span>{openJobs.length} jobs</span>
            </div>
            {openJobs.length > 0 ? (
              <div className="stacked-list">
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
        </div>

        <aside className="job-detail-pane">
          {job ? (
            <>
              <div className="section-heading">
                <h3>Selected Job</h3>
                <span>Job #{job.job_id}</span>
              </div>
              <JobCard
                job={job}
                onAccept={job.freelancer_wallet || selectedJobCompleted ? undefined : acceptJob}
                onReject={selectedJobCompleted ? undefined : rejectJob}
                isSelected
                statusLabel={selectedJobCompleted ? "Completed" : undefined}
                statusTone={selectedJobCompleted ? "completed" : "default"}
                paymentAmount={selectedJobCompleted ? formatPayment(selectedPaymentTotal) : undefined}
              />

              {selectedJobCompleted && (
                <div className="payment-summary">
                  <span className="status-pill status-pill-completed">Payment received</span>
                  <h3>Money received</h3>
                  <strong>{formatPayment(selectedPaymentTotal)}</strong>
                  <small>{job.title} is complete. Escrow payment has been released to your freelancer wallet.</small>
                </div>
              )}

              {milestones.length > 0 && (
                <div className="card compact-card">
                  <h3>Milestones</h3>
                  {milestones.map((m, idx) => (
                    <small key={m.milestone_id}>
                      #{idx} - Milestone ID {m.milestone_id}: {m.name} ({m.status})
                      {canSubmitMilestone(milestones, idx) ? " - ready to submit" : ""}
                    </small>
                  ))}
                </div>
              )}

              {normalizeWallet(job.freelancer_wallet) === walletAddress && !selectedJobCompleted && (
                <form className="grid-form compact-form" onSubmit={submitMilestone}>
                  <h3>Submit Completed Milestone</h3>
                  <div className="row-actions">
                    <button
                      type="button"
                      className={selectedJobNeedsSubmissionSync ? "" : "ghost"}
                      onClick={syncSubmittedMilestoneOnChain}
                    >
                      Sync Submitted Milestone On-chain
                    </button>
                    <button type="button" className="ghost" onClick={syncOnChainAccept}>
                      Sync On-chain Accept
                    </button>
                  </div>
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
                      {getSubmissionHint(milestones)}
                    </p>
                  )}
                </form>
              )}
            </>
          ) : (
            <p className="empty-state">Select one of your assigned jobs to submit milestones here.</p>
          )}
        </aside>
      </div>
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
