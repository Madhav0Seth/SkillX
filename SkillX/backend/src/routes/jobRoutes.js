const express = require("express");
const { supabase } = require("../config/supabase");
const { sha256 } = require("../utils/hash");
const { badRequest, internalError, notFound } = require("../utils/http");

// The Soroban storage key must be independent from job_hash. job_hash identifies
// the off-chain document; this derives the canonical 32-byte on-chain key from
// the immutable database job id after the row has been created.
function canonicalOnChainJobId(jobId) {
  return sha256(`skillx:soroban-job-id:v1:${jobId}`);
}
const { isWalletAddress, normalizeWallet, normalizeSkills, pageLimit, positiveId, requiredText, validateMilestones } = require("../utils/validation");

const router = express.Router();
const JOB_JOIN_SELECT = `
  *,
  client:users!client_wallet ( wallet_address, role, bio, avatar_url, name ),
  freelancer:users!freelancer_wallet ( wallet_address, role, bio, avatar_url, name )
`;

function hasRole(profile, role) {
  return profile?.role === role || profile?.role === "both";
}

async function findJob(jobId, select = "*") {
  const { data, error } = await supabase.from("jobs").select(select).eq("job_id", jobId).maybeSingle();
  if (error) throw error;
  return data;
}

async function findProfile(walletAddress) {
  const { data, error } = await supabase.from("users").select("wallet_address, role").eq("wallet_address", walletAddress).maybeSingle();
  if (error) throw error;
  return data;
}

router.get("/jobs", async (req, res) => {
  try {
    const { freelancer_wallet, client_wallet, scope, skill } = req.query;
    const freelancerWallet = normalizeWallet(freelancer_wallet);
    const normalizedSkill = typeof skill === "string" ? skill.trim() : "";
    if (skill !== undefined && (!normalizedSkill || normalizedSkill.length > 80)) return badRequest(res, "skill must be a short string no longer than 80 characters");
    const clientWallet = normalizeWallet(client_wallet);
    const limit = pageLimit(req.query.limit);
    if (limit === null) return badRequest(res, "limit must be a positive integer no greater than 100");
    if (![undefined, "open", "assigned"].includes(scope)) return badRequest(res, "scope must be open or assigned");
    if (freelancer_wallet && !isWalletAddress(freelancerWallet)) return badRequest(res, "freelancer_wallet must be a Stellar public key");
    if (client_wallet && !isWalletAddress(clientWallet)) return badRequest(res, "client_wallet must be a Stellar public key");
    let query = supabase.from("jobs").select(JOB_JOIN_SELECT).order("job_id", { ascending: false }).limit(limit);
    if (freelancerWallet) {
      if (scope === "assigned") query = query.eq("freelancer_wallet", freelancerWallet);
      else if (scope === "open") query = query.is("freelancer_wallet", null);
      else query = query.or(`freelancer_wallet.eq.${freelancerWallet},freelancer_wallet.is.null`);
    } else if (scope === "open") query = query.is("freelancer_wallet", null);
    if (clientWallet) query = query.eq("client_wallet", clientWallet);
    // `skills` is a Postgres text[] column. Filtering it with ilike makes
    // PostgREST attempt a scalar text comparison and can fail with an array
    // operator/type error. Use the native array overlap operator instead.
    // Keep the filter optional so older rows (or callers without skill) work.
    if (normalizedSkill) query = query.overlaps("skills", [normalizedSkill]);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ jobs: data || [] });
  } catch (error) { return internalError(res, error); }
});

router.post("/job", async (req, res) => {
  try {
    const { client_wallet, freelancer_wallet, title, description, milestones, skills } = req.body || {};
    const normalizedSkills = normalizeSkills(skills);
    if (normalizedSkills === null) return badRequest(res, "skills must be an array of up to 30 short strings (max 80 characters each)");
    const clientWallet = normalizeWallet(client_wallet);
    const freelancerWallet = freelancer_wallet ? normalizeWallet(freelancer_wallet) : null;
    const validationError =
      (!isWalletAddress(clientWallet) && "client_wallet must be a Stellar public key") ||
      (freelancerWallet && !isWalletAddress(freelancerWallet) && "freelancer_wallet must be a Stellar public key") ||
      requiredText(title, "title", { min: 3, max: 160 }) || requiredText(description, "description", { min: 10, max: 5000 }) || validateMilestones(milestones);
    if (validationError) return badRequest(res, validationError);
    if (clientWallet === freelancerWallet) return badRequest(res, "client and freelancer wallets must be different");
    const clientProfile = await findProfile(clientWallet);
    if (!hasRole(clientProfile, "client")) return res.status(403).json({ error: "Client profile is required to create jobs" });
    if (freelancerWallet && !hasRole(await findProfile(freelancerWallet), "freelancer")) return badRequest(res, "Selected wallet is not registered as a freelancer");
    const jobHash = sha256(JSON.stringify({ client_wallet: clientWallet, freelancer_wallet: freelancerWallet, title: title.trim(), description: description.trim() }));
    const normalizedMilestones = milestones.map(({ name, percentage, amount, deadline }) => ({ name: name.trim(), percentage: Number(percentage), amount: Number(amount), deadline }));
    const { data, error } = await supabase.rpc("create_job_with_milestones", { p_client_wallet: clientWallet, p_freelancer_wallet: freelancerWallet, p_title: title.trim(), p_description: description.trim(), p_job_hash: jobHash, p_milestones: normalizedMilestones, p_skills: normalizedSkills });
    if (error) throw error;
    if (!data?.job?.job_id) {
      const configurationError = new Error("create_job_with_milestones returned an invalid result");
      configurationError.code = "JOB_CREATION_RPC_INVALID_RESULT";
      throw configurationError;
    }

    const onChainJobId = canonicalOnChainJobId(data.job.job_id);
    const { data: job, error: updateError } = await supabase
      .from("jobs")
      .update({ on_chain_job_id: onChainJobId })
      .eq("job_id", data.job.job_id)
      .is("on_chain_job_id", null)
      .select()
      .single();
    if (updateError) throw updateError;

    return res.status(201).json({ ...data, job });
  } catch (error) { return internalError(res, error); }
});

router.post("/job/:jobId/accept", async (req, res) => {
  try {
    const jobId = positiveId(req.params.jobId);
    const freelancerWallet = normalizeWallet(req.body?.freelancer_wallet);
    if (!jobId || !isWalletAddress(freelancerWallet)) return badRequest(res, "jobId and a valid freelancer_wallet are required");
    if (!hasRole(await findProfile(freelancerWallet), "freelancer")) return res.status(403).json({ error: "Freelancer profile is required to accept jobs" });
    const { data, error } = await supabase.from("jobs").update({ freelancer_wallet: freelancerWallet }).eq("job_id", jobId).is("freelancer_wallet", null).select().maybeSingle();
    if (error) throw error;
    if (!data) return (await findJob(jobId)) ? res.status(409).json({ error: "Job is already assigned" }) : notFound(res, "Job not found");
    return res.json({ job: data });
  } catch (error) { return internalError(res, error); }
});

router.post("/job/:jobId/reject", async (req, res) => {
  try {
    const jobId = positiveId(req.params.jobId);
    const freelancerWallet = normalizeWallet(req.body?.freelancer_wallet);
    if (!jobId || !isWalletAddress(freelancerWallet)) return badRequest(res, "jobId and a valid freelancer_wallet are required");
    const { data, error } = await supabase.from("jobs").update({ freelancer_wallet: null }).eq("job_id", jobId).eq("freelancer_wallet", freelancerWallet).select().maybeSingle();
    if (error) throw error;
    if (!data) return (await findJob(jobId)) ? res.status(409).json({ error: "Only the assigned freelancer can relinquish this job" }) : notFound(res, "Job not found");
    return res.json({ job: data });
  } catch (error) { return internalError(res, error); }
});

router.post("/milestone/:milestoneId/approve", async (req, res) => {
  try {
    const milestoneId = positiveId(req.params.milestoneId);
    const clientWallet = normalizeWallet(req.body?.client_wallet);
    if (!milestoneId || !isWalletAddress(clientWallet)) return badRequest(res, "milestoneId and a valid client_wallet are required");
    const { data, error } = await supabase.rpc("approve_milestone", { p_milestone_id: milestoneId, p_client_wallet: clientWallet });
    if (error) throw error;
    if (data?.error === "not_found") return notFound(res, "Milestone not found");
    if (data?.error === "forbidden") return res.status(403).json({ error: "Only the job client can approve this milestone" });
    if (data?.error === "invalid_status") return badRequest(res, "Milestone must be submitted before approval");
    return res.json(data);
  } catch (error) { return internalError(res, error); }
});

router.get("/job/:jobId", async (req, res) => {
  try {
    const jobId = positiveId(req.params.jobId);
    if (!jobId) return badRequest(res, "jobId must be a positive integer");
    const job = await findJob(jobId, JOB_JOIN_SELECT);
    if (!job) return notFound(res, "Job not found");
    const { data: milestones, error } = await supabase.from("milestones").select("*").eq("job_id", jobId).order("milestone_id");
    if (error) throw error;
    return res.json({ job, milestones: milestones || [] });
  } catch (error) { return internalError(res, error); }
});

module.exports = router;
