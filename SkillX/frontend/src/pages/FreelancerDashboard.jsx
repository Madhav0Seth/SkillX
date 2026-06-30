import { useRef, useState } from "react";
import { api } from "../services/api";
import { contracts } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import JobCard from "../components/JobCard";
import { getJobStatus, getMilestoneStatus } from "../utils/contractStatus";


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

  const openJobsRef = useRef(null);
  const assignedJobsRef = useRef(null);
  const detailPaneRef = useRef(null);

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
      lower.includes("paid") ||
      lower.includes("accepted") ||
      lower.includes("submitted")
    ) {
      return "success";
    }
    return "info";
  };

  const handleDismiss = () => {
    setStatus("");
    setTxHash("");
  };

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
      setTimeout(() => {
        assignedJobsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
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
      setTimeout(() => {
        openJobsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
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
      setTimeout(() => {
        detailPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
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
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Freelancer Dashboard</h2>
        <p className="subtitle">Accept open jobs, submit milestones, and check on-chain payments.</p>
      </div>

      {/* SECTION 1: SEARCH & LOAD JOBS */}
      <section className="dashboard-section">
        <header className="section-header">
          <span className="section-badge">01</span>
          <h3>Job Controls</h3>
        </header>

        <div className="card" style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", gap: "1rem" }}>
          <h3>Load and Filter Jobs</h3>
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
      </section>

      {/* SECTION 2: WORKSPACE */}
      <section className="dashboard-section">
        <header className="section-header">
          <span className="section-badge">02</span>
          <h3>Freelancer Workspace</h3>
        </header>

        <div className="freelancer-workspace">
          <div className="job-list-pane">
            <div className="workspace-card-section" ref={assignedJobsRef}>
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
                      variant="assigned"
                      statusLabel="In Progress"
                      statusTone="assigned"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  iconType="jobs"
                  title="No Assigned Jobs"
                  message="Jobs assigned to your wallet will appear here. Click load to fetch your workspace."
                  action={<button onClick={loadMyJobs} style={{ marginTop: "1rem" }}>View My Jobs</button>}
                />
              )}
            </div>

            <div className="workspace-card-section">
              <div className="section-heading">
                <h3>Completed Jobs</h3>
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
                <EmptyState
                  iconType="jobs"
                  title="No Completed Jobs"
                  message="Once you finish all milestones for a job and receive your payout, it will appear here."
                />
              )}
            </div>

            <div className="workspace-card-section" ref={openJobsRef}>
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
                <EmptyState
                  iconType="search"
                  title="Browse Open Projects"
                  message="Look for jobs posted by clients that don't have an assigned freelancer yet."
                  action={<button className="ghost" onClick={loadOpenJobs} style={{ marginTop: "1rem" }}>View Open Jobs</button>}
                />
              )}
            </div>
          </div>

          <aside className="job-detail-pane" ref={detailPaneRef}>
            {job ? (
              <>
                <div className="section-heading">
                  <h3>Selected Job</h3>
                  <span>Job #{job.job_id}</span>
                </div>
                <JobCard
                  job={job}
                  onAccept={job.freelancer_wallet || selectedJobCompleted ? undefined : acceptJob}
                  onReject={job.freelancer_wallet || selectedJobCompleted ? undefined : rejectJob}
                  isSelected
                  statusLabel={selectedJobCompleted ? "Completed" : undefined}
                  statusTone={selectedJobCompleted ? "completed" : "default"}
                  paymentAmount={selectedJobCompleted ? formatPayment(selectedPaymentTotal) : undefined}
                />

                {job.freelancer?.reputation && (
                  <div className="reputation-card" style={{ marginTop: "1rem" }}>
                    <div className="reputation-card-header">
                      <span className="reputation-badge-title">Client Reputation Snapshot</span>
                      <span className="reputation-card-chip">{job.freelancer.reputation.tier || "New"}</span>
                    </div>
                    <div className="reputation-card-metrics">
                      <span>{Number(job.freelancer.reputation.completed_jobs || 0)} completed</span>
                      <span>{Number(job.freelancer.reputation.ontime_delivery_pct || 0)}% on-time</span>
                      <span>{formatPayment(job.freelancer.reputation.total_value_settled || 0)} USDC</span>
                    </div>
                    <small className="reputation-badge-caption">{job.freelancer.reputation.summary || "Verified delivery history"}</small>
                  </div>
                )}

                {selectedJobCompleted && (
                  <div className="payment-summary">
                    <span className="status-pill status-pill-completed">Payment received</span>
                    <h3>Money received</h3>
                    <strong>{formatPayment(selectedPaymentTotal)}</strong>
                    <small>{job.title} is complete. Escrow payment has been released to your freelancer wallet.</small>
                  </div>
                )}

                {milestones.length > 0 && (
                  <div className="card compact-card" style={{ marginTop: "1rem" }}>
                    <h3>Milestones</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "0.5rem" }}>
                      {milestones.map((m, idx) => (
                        <div key={m.milestone_id} style={{ display: "flex", flexDirection: "column", gap: "0.2rem", padding: "0.6rem 0.8rem", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-2)" }}>
                          <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>#{idx} - {m.name}</strong>
                          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                            Status: <span style={{ fontWeight: 600, color: m.status === "approved" || m.status === "paid" ? "var(--crayon-green)" : m.status === "submitted" ? "var(--crayon-blue)" : "var(--crayon-orange)" }}>{m.status}</span>
                            {canSubmitMilestone(milestones, idx) ? " (ready to submit)" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {normalizeWallet(job.freelancer_wallet) === walletAddress && !selectedJobCompleted && (
                  <form className="grid-form compact-form" onSubmit={submitMilestone} style={{ marginTop: "1rem" }}>
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
                    <label style={{ marginTop: "1rem" }}>
                      Completed milestone
                      <select
                        value={milestoneId}
                        onChange={(e) => setJobId ? setMilestoneId(e.target.value) : undefined}
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
              <EmptyState
                iconType="select"
                title="No Job Selected"
                message="Select any job card from the lists to view detailed milestone breakdowns, submit work, or sync on-chain statuses."
              />
            )}
          </aside>
        </div>
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
