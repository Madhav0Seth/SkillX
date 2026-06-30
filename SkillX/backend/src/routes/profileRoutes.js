const express = require("express");
const { supabase } = require("../config/supabase");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();
const VALID_ROLES = new Set(["client", "freelancer", "both"]);

function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

async function getWalletStats(walletAddress) {
  const normalizedWalletAddress = normalizeWallet(walletAddress);
  const emptyStats = {
    jobs_completed: 0,
    total_value_settled: 0,
    escrows_completed: 0,
    ontime_delivery_pct: 0,
    milestones_completed: 0,
  };

  if (!normalizedWalletAddress) {
    return {
      stats: emptyStats,
      reputation: {
        completed_jobs: 0,
        total_value_settled: 0,
        ontime_delivery_pct: 0,
        summary: "No completed jobs yet",
        tier: "New",
      },
    };
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("job_id, client_wallet, freelancer_wallet")
    .or(
      `client_wallet.ilike.${normalizedWalletAddress},freelancer_wallet.ilike.${normalizedWalletAddress}`
    );

  if (jobsError) throw jobsError;

  const jobIds = (jobs || []).map((j) => j.job_id);

  if (jobIds.length === 0) {
    return {
      stats: emptyStats,
      reputation: {
        completed_jobs: 0,
        total_value_settled: 0,
        ontime_delivery_pct: 0,
        summary: "No completed jobs yet",
        tier: "New",
      },
    };
  }

  const { data: milestones, error: msError } = await supabase
    .from("milestones")
    .select("milestone_id, job_id, status, amount, deadline")
    .in("job_id", jobIds);

  if (msError) throw msError;

  const allMilestones = milestones || [];
  const milestonesByJob = {};
  for (const ms of allMilestones) {
    if (!milestonesByJob[ms.job_id]) milestonesByJob[ms.job_id] = [];
    milestonesByJob[ms.job_id].push(ms);
  }

  let jobsCompleted = 0;
  for (const jobId of jobIds) {
    const jobMs = milestonesByJob[jobId] || [];
    if (jobMs.length > 0 && jobMs.every((m) => m.status === "approved")) {
      jobsCompleted++;
    }
  }

  const approvedMilestones = allMilestones.filter((m) => m.status === "approved");
  const milestonesCompleted = approvedMilestones.length;
  const totalValueSettled = approvedMilestones.reduce(
    (sum, m) => sum + Number(m.amount || 0),
    0
  );

  let escrowsCompleted = 0;
  for (const job of jobs || []) {
    if (job.freelancer_wallet) {
      const jobMs = milestonesByJob[job.job_id] || [];
      if (jobMs.some((m) => m.status === "approved")) {
        escrowsCompleted++;
      }
    }
  }

  let ontimeCount = 0;
  let totalWithDeadline = 0;
  if (approvedMilestones.length > 0) {
    const approvedIds = approvedMilestones.map((m) => m.milestone_id);
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("milestone_id, created_at")
      .in("milestone_id", approvedIds);

    if (subError) throw subError;

    const latestSubmission = {};
    for (const sub of submissions || []) {
      const existing = latestSubmission[sub.milestone_id];
      if (!existing || new Date(sub.created_at) > new Date(existing)) {
        latestSubmission[sub.milestone_id] = sub.created_at;
      }
    }

    for (const ms of approvedMilestones) {
      if (ms.deadline) {
        totalWithDeadline++;
        const subTime = latestSubmission[ms.milestone_id];
        if (subTime && new Date(subTime) <= new Date(ms.deadline)) {
          ontimeCount++;
        } else if (!subTime) {
          ontimeCount++;
        }
      }
    }
  }

  const ontimeDeliveryPct =
    totalWithDeadline > 0
      ? Math.round((ontimeCount / totalWithDeadline) * 100)
      : milestonesCompleted > 0
      ? 100
      : 0;

  const stats = {
    jobs_completed: jobsCompleted,
    total_value_settled: Math.round(totalValueSettled * 100) / 100,
    escrows_completed: escrowsCompleted,
    ontime_delivery_pct: ontimeDeliveryPct,
    milestones_completed: milestonesCompleted,
  };

  const reputation = {
    completed_jobs: jobsCompleted,
    total_value_settled: Math.round(totalValueSettled * 100) / 100,
    ontime_delivery_pct: ontimeDeliveryPct,
    summary:
      jobsCompleted > 0
        ? `${jobsCompleted} completed job${jobsCompleted === 1 ? "" : "s"} • ${ontimeDeliveryPct}% on-time`
        : "No completed jobs yet",
    tier: jobsCompleted >= 5 ? "Established" : jobsCompleted >= 2 ? "Growing" : jobsCompleted > 0 ? "Rising" : "New",
  };

  return { stats, reputation };
}

const PROFILE_SELECT = "wallet_address, role, skills, bio, portfolio, avatar_url, name";

router.post("/profile", async (req, res) => {
  try {
    const { wallet_address, role, skills, bio, portfolio, avatar_url, name } = req.body;
    const walletAddress = normalizeWallet(wallet_address);

    if (!walletAddress || !role) {
      return badRequest(res, "wallet_address and role are required");
    }
    if (!VALID_ROLES.has(role)) {
      return badRequest(res, "role must be client, freelancer, or both");
    }

    const payload = {
      wallet_address: walletAddress,
      role,
      skills: skills || [],
      bio: bio || "",
      portfolio: portfolio || "",
      avatar_url: avatar_url || "",
      name: name || ""
    };

    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "wallet_address" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ profile: data });
  } catch (error) {
    return internalError(res, error);
  }
});

router.get("/profile/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const normalizedWalletAddress = normalizeWallet(walletAddress);

    if (!normalizedWalletAddress) {
      return badRequest(res, "walletAddress is required");
    }

    const { data, error } = await supabase
      .from("users")
      .select(PROFILE_SELECT)
      .ilike("wallet_address", normalizedWalletAddress)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          error: "Profile not found. Please register on the Role page first.",
        });
      }
      throw error;
    }

    const { reputation } = await getWalletStats(normalizedWalletAddress);
    return res.json({ profile: { ...data, reputation } });
  } catch (error) {
    return internalError(res, error);
  }
});

router.get("/freelancers", async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from("users")
      .select(PROFILE_SELECT)
      .in("role", ["freelancer", "both"]);

    if (category) {
      query = query.contains("skills", [category]);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const freelancersWithReputation = await Promise.all(
      (data || []).map(async (profile) => {
        const { reputation } = await getWalletStats(profile.wallet_address);
        return { ...profile, reputation };
      })
    );

    return res.json({ freelancers: freelancersWithReputation });
  } catch (error) {
    return internalError(res, error);
  }
});

/**
 * GET /profile/:walletAddress/stats
 * Returns real, computed stats for a wallet from the database.
 */
router.get("/profile/:walletAddress/stats", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const normalized = normalizeWallet(walletAddress);

    if (!normalized) {
      return badRequest(res, "walletAddress is required");
    }

    const { stats, reputation } = await getWalletStats(normalized);

    return res.json({
      stats,
      reputation,
    });
  } catch (error) {
    return internalError(res, error);
  }
});

module.exports = router;
