const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();

router.get("/jobs", async (req, res) => {
  try {
    const { freelancer_wallet, client_wallet, limit } = req.query;

    let query = supabase
      .from("jobs")
      .select("*")
      .order("job_id", { ascending: false });

    if (freelancer_wallet) {
      query = query.or(
        `freelancer_wallet.eq.${freelancer_wallet},freelancer_wallet.is.null`
      );
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

    const jobHash = sha256(
      JSON.stringify({
        client_wallet,
        freelancer_wallet: freelancer_wallet || null,
        title,
        description
      })
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        client_wallet,
        freelancer_wallet: freelancer_wallet || null,
        title,
        description,
        job_hash: jobHash
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
        percentage: milestone.percentage,
        amount: milestone.amount,
        deadline: milestone.deadline,
        status: milestone.status || "pending"
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
      milestones: createdMilestones
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
