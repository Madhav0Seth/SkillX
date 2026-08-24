import { useRef, useState } from "react";
import TransactionLoader from "../components/TransactionLoader";
import { api } from "../services/api";
import { contracts, requireOnChainJobId } from "../services/contracts";
import { useWallet } from "../context/WalletContext";
import FreelancerCard from "../components/FreelancerCard";
import JobCard from "../components/JobCard";
import WorkspaceSidebar from "../components/WorkspaceSidebar";
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
  const [activeTab, setActiveTab] = useState("jobs");
  const [category, setCategory] = useState("");
  const [freelancers, setFreelancers] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [freelancerWallet, setFreelancerWallet] = useState("");
  const [milestones, setMilestones] = useState([emptyMilestone()]);
  const [myJobs, setMyJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState([]);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [newJobFunding, setNewJobFunding] = useState(null);
  const [isFundingNewJob, setIsFundingNewJob] = useState(false);
  const [transaction, setTransaction] = useState(null);

  const beginTransaction = (action) => {
    setTransaction({ action, phase: "wallet" });
    return (phase) => setTransaction((current) =>
      current ? { ...current, phase } : current
    );
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

      // A recovered submission is intentionally reviewable even when its
      // off-chain URL/details are absent; on-chain Submitted is authoritative.
      const recoveredPending = (result.milestones || []).some(
        (milestone) => milestone.status === "submitted"
      );
      if (recoveredPending) {
        setStatus("Loaded submitted milestone(s) for review. If a submission URL/details are unavailable, the on-chain Submitted status is still authoritative.");
      }

      // An accepted open job needs a client-signed registration before the
      // freelancer can submit. Attempt recovery on load, but keep the job
      // visible if the client wallet is not ready to sign.
      if (result.job?.freelancer_wallet) {
        try {
          const registration = await ensureMilestonesRegisteredOnChain(
            result.job,
            result.milestones || []
          );
          if (registration === "registered") {
            setStatus(
              `Loaded job ${result.job.job_id}. Registered milestones on-chain for this accepted job.`
            );
          }
        } catch (registerError) {
          setStatus(
            `Loaded job ${result.job.job_id}. On-chain milestone registration pending: ${registerError.message}`
          );
        }
      }
    } catch (error) {
      setStatus(`Failed to load job details: ${error.message}`);
    }
  };

  // Register milestones on-chain for an OPEN job that a freelancer has now
  // accepted. Open jobs are posted with create_and_fund_job (job + escrow
  // only, no milestones), so the client must register the schedule once a
  // freelancer exists. This is client-signed because MilestoneManager
  // .add_milestones requires the client's auth. No-op (returns "already")
  // for direct-assigned jobs whose milestones were registered at post time.
  const ensureMilestonesRegisteredOnChain = async (jobArg, milestonesArg = [], onPhase) => {
    if (!address || !jobArg) return false;

    const freelancerWallet = normalizeWallet(jobArg.freelancer_wallet);
    // No freelancer yet → still an unaccepted open job, nothing to register.
    if (!freelancerWallet) return false;

    // If milestones already exist on-chain, do nothing (no wallet prompt).
    try {
      await contracts.getMilestonesOnChain(requireOnChainJobId(jobArg));
      return "already";
    } catch (_notRegistered) {
      // Not registered yet — fall through and register them.
    }

    const parsed = (milestonesArg || []).map((m) => ({
      ...m,
      percentage: Number(m.percentage),
      amount: Number(m.amount),
      deadlineTs: Math.floor(new Date(m.deadline).getTime() / 1000),
    }));
    const totalAmount = parsed.reduce((sum, m) => sum + m.amount, 0);
    const milestoneHashes = await Promise.all(
      parsed.map((m) =>
        sha256Hex(
          JSON.stringify({
            name: m.name,
            percentage: m.percentage,
            deadline: m.deadline,
          })
        )
      )
    );

    try {
      const txResult = await contracts.addMilestonesOnChain({
        jobIdHex: requireOnChainJobId(jobArg),
        clientAddress: address,
        freelancerAddress: freelancerWallet,
        totalAmount,
        milestoneHashesHex: milestoneHashes,
        milestonePercentages: parsed.map((m) => m.percentage),
        milestoneDeadlines: parsed.map((m) => m.deadlineTs),
        onPhase,
      });
      setTxHash(txResult.hash);
      return "registered";
    } catch (error) {
      // A concurrent registration may have already happened — treat as done.
      if (error.message.includes("milestones already registered")) {
        return "already";
      }
      throw error;
    }
  };

  const registerSelectedJobMilestones = async () => {
    if (!address || !selectedJob) {
      setStatus("Load an accepted job and connect the client wallet first.");
      return;
    }

    const onPhase = beginTransaction("Registering milestones");
    try {
      const registration = await ensureMilestonesRegisteredOnChain(
        selectedJob,
        selectedMilestones,
        onPhase
      );
      if (registration === "registered") {
        setStatus(
          `Registered milestones on-chain for job ${selectedJob.job_id}. The freelancer can submit the first pending milestone now.`
        );
      } else if (registration === "already") {
        setStatus(`Milestones are already registered on-chain for job ${selectedJob.job_id}.`);
      } else {
        setStatus("This job has not been accepted yet, so there is no freelancer to bind to its milestone schedule.");
      }
    } catch (error) {
      setStatus(`Milestone registration failed: ${error.message}`);
    } finally {
      setTransaction(null);
    }
  };

  const approveMilestone = async (milestone) => {
    if (!address || !selectedJob) {
      setStatus("Load a job and connect the client wallet first.");
      return;
    }
    const onPhase = beginTransaction("Approving and paying milestone");
    try {
      // Make sure milestones exist on-chain first (open jobs register them
      // lazily once a freelancer has accepted).
      try {
        await ensureMilestonesRegisteredOnChain(selectedJob, selectedMilestones, onPhase);
      } catch (registerError) {
        setStatus(
          `Cannot approve yet: milestones are not registered on-chain. ${registerError.message}`
        );
        return;
      }

      const index = selectedMilestones.findIndex(
        (item) => Number(item.milestone_id) === Number(milestone.milestone_id)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }

      const onChainMilestone = await contracts.getMilestoneOnChain(
        requireOnChainJobId(selectedJob),
        index
      );
      if (!onChainMilestone) {
        setStatus(
          `Cannot approve yet. On-chain milestone ${index} is unavailable. Confirm milestones are registered on-chain, then try again.`
        );
        return;
      }
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

      const txResult = await contracts.fundAndApproveOnChain(
        requireOnChainJobId(selectedJob),
        index,
        normalizeWallet(address),
        { onPhase }
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
    } finally {
      setTransaction(null);
    }
  };

  const syncApprovedPaymentOnChain = async (milestone) => {
    if (!address || !selectedJob) {
      setStatus("Load a job and connect the client wallet first.");
      return;
    }

    const onPhase = beginTransaction("Syncing milestone payment");
    try {
      const index = selectedMilestones.findIndex(
        (item) => Number(item.milestone_id) === Number(milestone.milestone_id)
      );
      if (index < 0) {
        setStatus("Selected milestone is not part of the loaded job.");
        return;
      }

      const onChainMilestone = await contracts.getMilestoneOnChain(
        requireOnChainJobId(selectedJob),
        index
      );
      if (!onChainMilestone) {
        setStatus(
          `Cannot sync payment. On-chain milestone ${index} is unavailable. Confirm milestones are registered on-chain, then try again.`
        );
        return;
      }
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

      await contracts.fundAndApproveOnChain(
        requireOnChainJobId(selectedJob),
        index,
        normalizeWallet(address),
        { onPhase }
      );
      setStatus(`Synced on-chain payment for milestone ${milestone.milestone_id}.`);
    } catch (error) {
      setStatus(`Payment sync failed: ${error.message}`);
    } finally {
      setTransaction(null);
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

    const onPhase = beginTransaction("Funding escrow");
    try {
      const currentBalance = toNumber(
        await contracts.getEscrowBalanceOnChain(requireOnChainJobId(selectedJob))
      );
      if (currentBalance >= totalAmount) {
        setStatus(`Escrow already has ${currentBalance.toLocaleString()} for job ${selectedJob.job_id}.`);
        return;
      }

      const txResult = await contracts.depositEscrowOnChain(
        requireOnChainJobId(selectedJob),
        address,
        totalAmount - currentBalance,
        { onPhase }
      );
      setTxHash(txResult.hash);
      setStatus(`Escrow funded for job ${selectedJob.job_id}. You can approve submitted milestones now.`);
    } catch (error) {
      const message = error.message.includes("job already funded")
        ? "Escrow is already funded for this job."
        : `Escrow funding failed: ${error.message}`;
      setStatus(message);
    } finally {
      setTransaction(null);
    }
  };

  const fundNewlyCreatedJob = async () => {
    if (!address || !newJobFunding?.job) {
      setStatus("Connect the client wallet and create a job first.");
      return;
    }

    const { job, milestones: createdMilestones = [] } = newJobFunding;
    const totalAmount = getMilestoneTotal(createdMilestones);
    if (totalAmount <= 0) {
      setStatus("Cannot fund escrow because this job has no milestone amount.");
      return;
    }

    setIsFundingNewJob(true);
    const onPhase = beginTransaction("Funding new job escrow");
    try {
      const currentBalance = toNumber(
        await contracts.getEscrowBalanceOnChain(requireOnChainJobId(job))
      );
      if (currentBalance >= totalAmount) {
        setNewJobFunding(null);
        setSelectedJob(job);
        setSelectedMilestones(createdMilestones);
        setActiveTab("jobs");
        setStatus(`Escrow is already funded for job ${job.job_id}.`);
        return;
      }

      const txResult = await contracts.depositEscrowOnChain(
        requireOnChainJobId(job),
        address,
        totalAmount - currentBalance,
        { onPhase }
      );
      setTxHash(txResult.hash);
      setNewJobFunding(null);
      setSelectedJob(job);
      setSelectedMilestones(createdMilestones);
      setMyJobs((previous) =>
        previous.some((item) => item.job_id === job.job_id)
          ? previous
          : [job, ...previous]
      );
      setActiveTab("jobs");
      setStatus(`Escrow funded for job ${job.job_id}. You can approve submitted milestones now.`);
    } catch (error) {
      const message = error.message.includes("job already funded")
        ? `Escrow is already funded for job ${job.job_id}.`
        : `Escrow funding failed: ${error.message}`;
      setStatus(message);
    } finally {
      setIsFundingNewJob(false);
      setTransaction(null);
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
    setActiveTab("post");
    setStatus(`Selected freelancer ${freelancer.wallet_address}. Switched to Post Job.`);
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
    const onPhase = beginTransaction("Creating job and funding escrow");
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

      // Freelancer is OPTIONAL. If a registered freelancer is selected, the
      // job is direct-assigned and posted in one atomic transaction. If left
      // empty, an Open Job is posted (any freelancer can accept it later) and
      // milestones are registered on-chain once someone accepts.
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
        milestones,
        skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean)
      };
      const result = await api.createJob(payload);
      const createdMilestones = result.milestones || parsedMilestones;
      setSelectedJob(result.job);
      setSelectedMilestones(createdMilestones);
      setMyJobs((previous) =>
        previous.some((item) => item.job_id === result.job.job_id)
          ? previous
          : [result.job, ...previous]
      );
      setTitle("");
      setDescription("");
      setSkills("");
      setFreelancerWallet("");
      setMilestones([emptyMilestone()]);
      setActiveTab("jobs");

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

        let txResult;
        if (normalizedFreelancerWallet) {
          // Direct-assigned job. Single atomic transaction: creates the job,
          // funds escrow, and registers milestones in one on-chain call →
          // ONE wallet signature instead of three.
          txResult = await contracts.createFullJobOnChain({
            jobIdHex: requireOnChainJobId(result.job),
            jobHashHex: result.job.job_hash,
            clientAddress: address,
            freelancerAddress: normalizedFreelancerWallet,
            totalAmount,
            milestoneHashesHex: milestoneHashes,
            milestonePercentages: parsedMilestones.map((m) => m.percentage),
            milestoneDeadlines: parsedMilestones.map((m) => m.deadlineTs),
            onPhase,
          });

          setTxHash(txResult.hash);
          setNewJobFunding(null);
          setStatus(`Job created on-chain, escrow funded, and milestones registered in a single transaction. DB Job ID: ${result.job.job_id}`);
        } else {
          // Open job (no freelancer yet). One transaction creates the job and
          // funds escrow. Milestones are registered on-chain later, once a
          // freelancer accepts the job (add_milestones needs the client's auth
          // and a concrete freelancer address, so it cannot run at post time).
          txResult = await contracts.createAndFundJobOnChain({
            jobIdHex: requireOnChainJobId(result.job),
            jobHashHex: result.job.job_hash,
            clientAddress: address,
            totalAmount,
            onPhase,
          });

          setTxHash(txResult.hash);
          setNewJobFunding(null);
          setStatus(`Open job posted on-chain and escrow funded in a single transaction. Milestones are registered on-chain once a freelancer accepts. DB Job ID: ${result.job.job_id}`);
        }
      } catch (contractError) {
        setNewJobFunding({ job: result.job, milestones: createdMilestones });
        const contractMessage = contractError.message.includes("VITE_JOB_MANAGER_CONTRACT_ID")
          ? "Job Manager contract ID is not configured."
          : contractError.message.includes("VITE_MILESTONE_MANAGER_CONTRACT_ID")
          ? "Milestone Manager contract ID is not configured."
          : contractError.message;
        setNewJobFunding({ job: result.job, milestones: createdMilestones });
        setStatus(
          `Job created in database. On-chain setup incomplete: ${contractMessage}`
        );
      }
    } catch (error) {
      setStatus(`Create failed: ${error.message}`);
    } finally {
      setTransaction(null);
    }
  };

  return (
    <div className="dashboard-container">
      <TransactionLoader transaction={transaction} />
      <div className="dashboard-header">
        <h2>Client Dashboard</h2>
        <p className="subtitle">Search freelancers, monitor milestones, and release escrow payments on-chain.</p>
      </div>

      <div className={`workspace-layout ${!isSidebarOpen ? "is-collapsed" : ""}`}>
        <WorkspaceSidebar
          label="Client workspace"
          activeId={activeTab}
          onChange={setActiveTab}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((current) => !current)}
          items={[
            { id: "jobs", label: "Manage Jobs", icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg> },
            { id: "post", label: "Post New Job", icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><path d="M12 5v14M5 12h14" /></svg> },
            { id: "find", label: "Find Freelancers", icon: <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> }
          ]}
        />

        <main className="workspace-main">
          {/* TAB 1: MANAGE ACTIVE JOBS */}
          {activeTab === "jobs" && (
            <section className="dashboard-section" style={{ marginTop: 0 }}>
              <header className="section-header">
                <span className="section-badge">01</span>
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
                    <button className="ghost" onClick={registerSelectedJobMilestones} disabled={Boolean(transaction)}>
                      Register Milestones On-chain
                    </button>
                    <button className="ghost" onClick={fundSelectedEscrow} disabled={Boolean(transaction)}>
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
                          <button onClick={() => approveMilestone(milestone)} disabled={Boolean(transaction)}>
                            Approve &amp; Pay
                          </button>
                        ) : milestone.status === "approved" ? (
                          <div className="row-actions">
                            <span className="status-pill status-pill-completed">
                              approved
                            </span>
                            <button className="ghost" onClick={() => syncApprovedPaymentOnChain(milestone)} disabled={Boolean(transaction)}>
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
          )}

          {/* TAB 2: POST A NEW JOB */}
          {activeTab === "post" && (
            <section className="dashboard-section" style={{ marginTop: 0 }}>
              <header className="section-header">
                <span className="section-badge">02</span>
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
                  <button type="submit" disabled={Boolean(transaction)}>Create Job</button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 3: FIND FREELANCERS */}
          {activeTab === "find" && (
            <section className="dashboard-section" style={{ marginTop: 0 }}>
              <header className="section-header">
                <span className="section-badge">03</span>
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
          )}
        </main>
      </div>

      {newJobFunding && (
        <div className="status-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fund-new-job-title">
          <div className="status-modal-content">
            <div className="status-icon info">ℹ</div>
            <h4 id="fund-new-job-title">Fund your new job</h4>
            <p className="status-message">
              Job #{newJobFunding.job.job_id} was created, but its escrow still needs funding. Fund {getMilestoneTotal(newJobFunding.milestones).toLocaleString()} XLM now to make it ready for milestone payments.
            </p>
            <div className="row-actions" style={{ justifyContent: "center" }}>
              <button onClick={fundNewlyCreatedJob} disabled={isFundingNewJob || Boolean(transaction)}>
                {isFundingNewJob ? "Funding Escrow…" : "Fund This Job"}
              </button>
              <button className="ghost" onClick={() => setNewJobFunding(null)} disabled={isFundingNewJob}>
                Fund Later
              </button>
            </div>
          </div>
        </div>
      )}

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
