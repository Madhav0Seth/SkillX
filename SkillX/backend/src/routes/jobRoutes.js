const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();

function hasRole(profile, role) {
  return profile?.role === role || profile?.role === "both";
}

function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

router.get("/jobs", async (req, res) => {
  try {
    const { freelancer_wallet, client_wallet, limit, scope } = req.query;
    const freelancerWallet = normalizeWallet(freelancer_wallet);
    const clientWallet = normalizeWallet(client_wallet);

    let query = supabase
      .from("jobs")
      .select("*")
      .order("job_id", { ascending: false });

    if (freelancerWallet) {
      if (scope === "assigned") {
        query = query.ilike("freelancer_wallet", freelancerWallet);
      } else if (scope === "open") {
        query = query.is("freelancer_wallet", null);
      } else {
        query = query.or(
          `freelancer_wallet.ilike.${freelancerWallet},freelancer_wallet.is.null`
        );
      }
    } else if (scope === "open") {
      query = query.is("freelancer_wallet", null);
    }

    if (clientWallet) {
      query = query.ilike("client_wallet", clientWallet);
    }

    if (limit) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return res.json({ jobs: data || [] });
  } catch (error) {
    return internalError(res, error);
  }
});

router.post("/job", async (req, res) => {
  try {
    const { client_wallet, freelancer_wallet, title, description, milestones } =
      req.body;
    const clientWallet = normalizeWallet(client_wallet);
    const freelancerWallet = normalizeWallet(freelancer_wallet);

    if (!clientWallet || !title || !description) {
      return badRequest(
        res,
        "client_wallet, title, and description are required"
      );
    }

    // 1. Verify client has a profile
    const { data: clientProfile, error: clientProfileError } = await supabase
      .from("users")
      .select("wallet_address, role")
      .ilike("wallet_address", clientWallet)
      .single();

    if (clientProfileError || !hasRole(clientProfile, "client")) {
      return res.status(403).json({
        error: "Client identity not found. Register as Client or Both before creating jobs.",
      });
    }

    // 2. Verify freelancer profile if wallet provided
    if (freelancerWallet) {
      const { data: freelancerProfile, error: freelancerProfileError } =
        await supabase
          .from("users")
          .select("wallet_address, role")
          .ilike("wallet_address", freelancerWallet)
          .single();

      if (freelancerProfileError || !hasRole(freelancerProfile, "freelancer")) {
        return res.status(400).json({
          error: `Selected wallet is not registered as a freelancer: ${freelancerWallet}`,
        });
      }
    }

    const jobHash = sha256(
      JSON.stringify({
        client_wallet: clientWallet,
        freelancer_wallet: freelancerWallet || null,
        title,
        description,
      })
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        client_wallet: clientWallet,
        freelancer_wallet: freelancerWallet || null,
        title,
        description,
        job_hash: jobHash,
      })
      .select()
      .single();

    if (jobError) {
      throw jobError;
    }

    let createdMilestones = [];
    if (Array.isArray(milestones) && milestones.length > 0) {
      const milestoneRows = milestones.map((milestone) => ({
        job_id: job.job_id,
        name: milestone.name,
        percentage: Number(milestone.percentage),
        amount: Number(milestone.amount),
        deadline: milestone.deadline,
        status: milestone.status || "pending",
      }));

      const { data, error } = await supabase
        .from("milestones")
        .insert(milestoneRows)
        .select();

      if (error) {
        throw error;
      }
      createdMilestones = data;
    }

    return res.status(201).json({
      job,
      milestones: createdMilestones,
    });
  } catch (error) {
    return internalError(res, error);
  }
});

router.post("/job/:jobId/accept", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { freelancer_wallet } = req.body;
    const freelancerWallet = normalizeWallet(freelancer_wallet);
    if (!jobId || !freelancerWallet) {
      return badRequest(res, "jobId and freelancer_wallet are required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("job_id", Number(jobId))
      .single();

    if (jobError) {
      throw jobError;
    }

    if (
      job.freelancer_wallet &&
      normalizeWallet(job.freelancer_wallet) !== freelancerWallet
    ) {
      return res.status(409).json({ error: "Job already accepted by another freelancer" });
    }

    const { data: freelancerProfile, error: freelancerProfileError } =
      await supabase
        .from("users")
        .select("wallet_address, role")
        .ilike("wallet_address", freelancerWallet)
        .single();

    if (freelancerProfileError || !hasRole(freelancerProfile, "freelancer")) {
      return res.status(403).json({
        error: "Freelancer identity not found. Register as Freelancer or Both before accepting jobs.",
      });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update({ freelancer_wallet: freelancerWallet })
      .eq("job_id", Number(jobId))
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ job: data });
  } catch (error) {
    return internalError(res, error);
  }
});

router.post("/job/:jobId/reject", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { freelancer_wallet } = req.body;
    const freelancerWallet = normalizeWallet(freelancer_wallet);
    if (!jobId || !freelancerWallet) {
      return badRequest(res, "jobId and freelancer_wallet are required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("job_id", Number(jobId))
      .single();

    if (jobError) {
      throw jobError;
    }

    if (
      job.freelancer_wallet &&
      normalizeWallet(job.freelancer_wallet) !== freelancerWallet
    ) {
      return res
        .status(409)
        .json({ error: "Cannot reject a job accepted by another freelancer" });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update({ freelancer_wallet: null })
      .eq("job_id", Number(jobId))
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ job: data });
  } catch (error) {
    return internalError(res, error);
  }
});

router.post("/milestone/:milestoneId/approve", async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { client_wallet } = req.body;
    const clientWallet = normalizeWallet(client_wallet);

    if (!milestoneId || !clientWallet) {
      return badRequest(res, "milestoneId and client_wallet are required");
    }

    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("milestone_id, job_id, status")
      .eq("milestone_id", Number(milestoneId))
      .single();

    if (milestoneError) {
      throw milestoneError;
    }

    if (milestone.status === "approved") {
      return res.json({ milestone });
    }

    if (milestone.status !== "submitted") {
      return badRequest(res, `Milestone must be submitted before approval. Current status: ${milestone.status}`);
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("job_id, client_wallet")
      .eq("job_id", milestone.job_id)
      .single();

    if (jobError) {
      throw jobError;
    }

    if (normalizeWallet(job.client_wallet) !== clientWallet) {
      return res.status(403).json({
        error: "Only the job client can approve this milestone.",
      });
    }

    const { data, error } = await supabase
      .from("milestones")
      .update({ status: "approved" })
      .eq("milestone_id", Number(milestoneId))
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({ milestone: data });
  } catch (error) {
    return internalError(res, error);
  }
});

router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return badRequest(res, "jobId is required");
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("job_id", Number(jobId))
      .single();

    if (jobError) {
      if (jobError.code === "PGRST116") {
        return res.status(404).json({ error: "Job not found" });
      }
      throw jobError;
    }

    const { data: milestones, error: milestoneError } = await supabase
      .from("milestones")
      .select("*")
      .eq("job_id", Number(jobId))
      .order("milestone_id", { ascending: true });

    if (milestoneError) {
      throw milestoneError;
    }

    return res.json({ job, milestones });
  } catch (error) {
    return internalError(res, error);
  }
});

module.exports = router;
