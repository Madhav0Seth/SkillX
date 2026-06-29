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

module.exports = router;
