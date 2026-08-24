const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError, notFound } = require("../utils/http");
const { isWalletAddress, normalizeWallet, positiveId, validateUrl } = require("../utils/validation");

const router = express.Router();

router.get("/notifications", async (req, res) => {
  try {
    const clientWallet = normalizeWallet(req.query?.client_wallet);
    if (!isWalletAddress(clientWallet)) return badRequest(res, "A valid client_wallet is required");
    const { data, error } = await supabase.from("notifications").select("*").eq("client_wallet", clientWallet).order("created_at", { ascending: false }).limit(50);
    if (error) {
      // Notifications are optional for reads: an older deployment may not
      // have the table yet. Keep the jobs dashboard usable while surfacing
      // other database failures to the caller.
      if (error.code === "42P01" || error.code === "PGRST205") {
        return res.json({ notifications: [], notificationsUnavailable: true });
      }
      throw error;
    }
    return res.json({ notifications: data || [] });
  } catch (error) { return internalError(res, error); }
});

router.post("/submit", async (req, res) => {
  try {
    const milestoneId = positiveId(req.body?.milestone_id);
    const freelancerWallet = normalizeWallet(req.body?.freelancer_wallet);
    const fileUrlError = validateUrl(req.body?.file_url, "file_url");
    if (!milestoneId || !isWalletAddress(freelancerWallet) || fileUrlError) return badRequest(res, fileUrlError || "milestone_id and a valid freelancer_wallet are required");
    const fileUrl = req.body.file_url.trim();
    const submissionHash = sha256(JSON.stringify({ milestone_id: milestoneId, file_url: fileUrl }));
    const { data, error } = await supabase.rpc("submit_milestone", { p_milestone_id: milestoneId, p_freelancer_wallet: freelancerWallet, p_file_url: fileUrl, p_submission_hash: submissionHash });
    if (error) throw error;
    if (data?.error === "not_found") return notFound(res, "Milestone not found");
    if (data?.error === "forbidden") return res.status(403).json({ error: "Only the assigned freelancer can submit this milestone" });
    if (data?.error === "invalid_status") return badRequest(res, "Milestone is not pending");
    if (data?.error === "previous_incomplete") return badRequest(res, "Submit milestones in order after earlier milestones are approved");
    return res.status(201).json(data);
  } catch (error) { return internalError(res, error); }
});

// The frontend verifies the matching Soroban milestone is Submitted before
// calling this endpoint. This route deliberately performs no chain write: it
// only reconciles local state and records that URL/details were unavailable.
router.post("/submit/recover", async (req, res) => {
  try {
    const milestoneId = positiveId(req.body?.milestone_id);
    const freelancerWallet = normalizeWallet(req.body?.freelancer_wallet);
    if (!milestoneId || !isWalletAddress(freelancerWallet)) {
      return badRequest(res, "milestone_id and a valid freelancer_wallet are required");
    }
    const { data, error } = await supabase.rpc("recover_submitted_milestone", {
      p_milestone_id: milestoneId,
      p_freelancer_wallet: freelancerWallet
    });
    if (error) throw error;
    if (data?.error === "not_found") return notFound(res, "Milestone not found");
    if (data?.error === "forbidden") return res.status(403).json({ error: "Only the assigned freelancer can recover this milestone" });
    if (data?.error === "invalid_status") return badRequest(res, "Only a pending milestone can be recovered as submitted");
    if (data?.error === "previous_incomplete") return badRequest(res, "Earlier milestones must be approved before recovery");
    return res.json(data);
  } catch (error) { return internalError(res, error); }
});

module.exports = router;
