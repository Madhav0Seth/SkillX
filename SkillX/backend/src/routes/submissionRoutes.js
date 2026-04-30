const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();

router.post("/submit", async (req, res) => {
  try {
    const { milestone_id, file_url } = req.body;

    if (!milestone_id || !file_url) {
      return badRequest(res, "milestone_id and file_url are required");
    }

    const { data: milestone, error: milestoneFetchError } = await supabase
      .from("milestones")
      .select("milestone_id, job_id, status")
      .eq("milestone_id", milestone_id)
      .single();

    if (milestoneFetchError) {
      throw milestoneFetchError;
    }

    if (milestone.status !== "pending") {
      return badRequest(res, `Milestone is already ${milestone.status}`);
    }

    const { data: jobMilestones, error: jobMilestonesError } = await supabase
      .from("milestones")
      .select("milestone_id, status")
      .eq("job_id", milestone.job_id)
      .order("milestone_id", { ascending: true });

    if (jobMilestonesError) {
      throw jobMilestonesError;
    }

    const milestoneIndex = (jobMilestones || []).findIndex(
      (item) => Number(item.milestone_id) === Number(milestone_id)
    );
    const previousIncomplete = (jobMilestones || [])
      .slice(0, milestoneIndex)
      .find((item) => item.status !== "approved");

    if (previousIncomplete) {
      return badRequest(
        res,
        "Submit milestones in order. Previous milestones must be approved and paid first."
      );
    }

    const submissionHash = sha256(
      JSON.stringify({
        milestone_id,
        file_url
      })
    );

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        milestone_id,
        submission_hash: submissionHash,
        file_url
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { error: milestoneError } = await supabase
      .from("milestones")
      .update({ status: "submitted" })
      .eq("milestone_id", milestone_id);

    if (milestoneError) {
      throw milestoneError;
    }

    return res.status(201).json({ submission: data });
  } catch (error) {
    return internalError(res, error);
  }
});

module.exports = router;
