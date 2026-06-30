const express = require("express");
const { supabase } = require("../config/supabase");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();
const VALID_ROLES = new Set(["client", "freelancer", "both"]);

function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

// Track whether dynamic columns exist to avoid repeated failures
let _columnsChecked = false;
let avatarColumnAvailable = false;
let nameColumnAvailable = false;

async function checkDynamicColumns() {
  if (_columnsChecked) return { avatarColumnAvailable, nameColumnAvailable };
  
  // Test avatar_url
  const { error: avatarErr } = await supabase.from("users").select("avatar_url").limit(0);
  avatarColumnAvailable = !avatarErr;
  
  // Test name
  const { error: nameErr } = await supabase.from("users").select("name").limit(0);
  nameColumnAvailable = !nameErr;
  
  _columnsChecked = true;
  return { avatarColumnAvailable, nameColumnAvailable };
}

function profileSelect(hasAvatar, hasName) {
  let base = "wallet_address, role, skills, bio, portfolio";
  if (hasAvatar) base += ", avatar_url";
  if (hasName) base += ", name";
  return base;
}

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

    const { avatarColumnAvailable, nameColumnAvailable } = await checkDynamicColumns();

    const payload = {
      wallet_address: walletAddress,
      role,
      skills: skills || [],
      bio: bio || "",
      portfolio: portfolio || ""
    };
    if (avatarColumnAvailable) {
      payload.avatar_url = avatar_url || "";
    }
    if (nameColumnAvailable) {
      payload.name = name || "";
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(payload, { onConflict: "wallet_address" })
      .select()
      .single();

    if (error) {
      // In case columns were removed during runtime, fallback gracefully
      if (error.message?.includes("avatar_url") || error.message?.includes("name")) {
        _columnsChecked = false; // force re-check next time
        delete payload.avatar_url;
        delete payload.name;
        const retry = await supabase
          .from("users")
          .upsert(payload, { onConflict: "wallet_address" })
          .select()
          .single();
        if (retry.error) throw retry.error;
        return res.status(201).json({ profile: retry.data });
      }
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

    const { avatarColumnAvailable, nameColumnAvailable } = await checkDynamicColumns();

    const { data, error } = await supabase
      .from("users")
      .select(profileSelect(avatarColumnAvailable, nameColumnAvailable))
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

    return res.json({ profile: data });
  } catch (error) {
    return internalError(res, error);
  }
});

router.get("/freelancers", async (req, res) => {
  try {
    const { category } = req.query;
    const { avatarColumnAvailable, nameColumnAvailable } = await checkDynamicColumns();

    let query = supabase
      .from("users")
      .select(profileSelect(avatarColumnAvailable, nameColumnAvailable))
      .in("role", ["freelancer", "both"]);

    if (category) {
      query = query.contains("skills", [category]);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return res.json({ freelancers: data });
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

    // 1. Get all jobs where this wallet is client OR freelancer
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("job_id, client_wallet, freelancer_wallet")
      .or(
        `client_wallet.ilike.${normalized},freelancer_wallet.ilike.${normalized}`
      );

    if (jobsError) throw jobsError;

    const jobIds = (jobs || []).map((j) => j.job_id);

    if (jobIds.length === 0) {
      return res.json({
        stats: {
          jobs_completed: 0,
          total_value_settled: 0,
          escrows_completed: 0,
          ontime_delivery_pct: 0,
          milestones_completed: 0,
        },
      });
    }

    // 2. Get all milestones for those jobs
    const { data: milestones, error: msError } = await supabase
      .from("milestones")
      .select("milestone_id, job_id, status, amount, deadline")
      .in("job_id", jobIds);

    if (msError) throw msError;

    const allMilestones = milestones || [];

    // 3. Group milestones by job_id
    const milestonesByJob = {};
    for (const ms of allMilestones) {
      if (!milestonesByJob[ms.job_id]) milestonesByJob[ms.job_id] = [];
      milestonesByJob[ms.job_id].push(ms);
    }

    // 4. Jobs Completed: jobs that have milestones AND all milestones are "approved"
    let jobsCompleted = 0;
    for (const jobId of jobIds) {
      const jobMs = milestonesByJob[jobId] || [];
      if (jobMs.length > 0 && jobMs.every((m) => m.status === "approved")) {
        jobsCompleted++;
      }
    }

    // 5. Milestones Completed + Total Value Settled
    const approvedMilestones = allMilestones.filter(
      (m) => m.status === "approved"
    );
    const milestonesCompleted = approvedMilestones.length;
    const totalValueSettled = approvedMilestones.reduce(
      (sum, m) => sum + Number(m.amount || 0),
      0
    );

    // 6. Escrows Completed: jobs with freelancer assigned AND at least one approved milestone
    let escrowsCompleted = 0;
    for (const job of jobs || []) {
      if (job.freelancer_wallet) {
        const jobMs = milestonesByJob[job.job_id] || [];
        if (jobMs.some((m) => m.status === "approved")) {
          escrowsCompleted++;
        }
      }
    }

    // 7. On-time Delivery %: we need submission timestamps
    //    A milestone is "on-time" if its latest submission was created before the deadline.
    let ontimeCount = 0;
    let totalWithDeadline = 0;

    if (approvedMilestones.length > 0) {
      const approvedIds = approvedMilestones.map((m) => m.milestone_id);

      const { data: submissions, error: subError } = await supabase
        .from("submissions")
        .select("milestone_id, created_at")
        .in("milestone_id", approvedIds);

      if (subError) throw subError;

      // Build map: milestone_id -> latest submission created_at
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
            // No submission record but approved — count as on-time
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

    return res.json({
      stats: {
        jobs_completed: jobsCompleted,
        total_value_settled: Math.round(totalValueSettled * 100) / 100,
        escrows_completed: escrowsCompleted,
        ontime_delivery_pct: ontimeDeliveryPct,
        milestones_completed: milestonesCompleted,
      },
    });
  } catch (error) {
    return internalError(res, error);
  }
});

module.exports = router;
