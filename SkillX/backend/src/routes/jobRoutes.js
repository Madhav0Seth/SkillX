const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();

router.get("/jobs", async (req, res) => {
  try {
    const { freelancer_wallet, client_wallet, limit, scope } = req.query;

    let query = supabase
      .from("jobs")
      .select("*")
      .order("job_id", { ascending: false });

    if (freelancer_wallet) {
      if (scope === "assigned") {
        query = query.eq("freelancer_wallet", freelancer_wallet);
      } else if (scope === "open") {
        query = query.is("freelancer_wallet", null);
      } else {
        query = query.or(
          `freelancer_wallet.eq.${freelancer_wallet},freelancer_wallet.is.null`
        );
      }
    } else if (scope === "open") {
      query = query.is("freelancer_wallet", null);
    }

    if (client_wallet) {
      query = query.eq("client_wallet", client_wallet);
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

    if (!client_wallet || !title || !description) {
      return badRequest(
        res,
        "client_wallet, title, and description are required"
      );
    }

    // 1. Verify client has a profile
    const { data: clientProfile, error: clientProfileError } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("wallet_address", client_wallet)
      .single();

    if (clientProfileError || !clientProfile) {
      return res.status(403).json({
        error: "Client profile not found. Please create a profile first.",
      });
    }

    // 2. Verify freelancer profile if wallet provided
    if (freelancer_wallet) {
      const { data: freelancerProfile, error: freelancerProfileError } =
        await supabase
          .from("users")
          .select("wallet_address")
          .eq("wallet_address", freelancer_wallet)
          .single();

      if (freelancerProfileError || !freelancerProfile) {
        return res.status(400).json({
          error: "Selected freelancer profile not found in our system.",
        });
      }
    }

    const jobHash = sha256(
      JSON.stringify({
        client_wallet,
        freelancer_wallet: freelancer_wallet || null,
        title,
        description,
      })
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        client_wallet,
        freelancer_wallet: freelancer_wallet || null,
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
    if (!jobId || !freelancer_wallet) {
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

    if (job.freelancer_wallet && job.freelancer_wallet !== freelancer_wallet) {
      return res.status(409).json({ error: "Job already accepted by another freelancer" });
    }

    const { data: freelancerProfile, error: freelancerProfileError } =
      await supabase
        .from("users")
        .select("wallet_address")
        .eq("wallet_address", freelancer_wallet)
        .single();

    if (freelancerProfileError || !freelancerProfile) {
      return res.status(403).json({
        error: "Freelancer profile not found. Please register before accepting jobs.",
      });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update({ freelancer_wallet })
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
    if (!jobId || !freelancer_wallet) {
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

    if (job.freelancer_wallet && job.freelancer_wallet !== freelancer_wallet) {
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
