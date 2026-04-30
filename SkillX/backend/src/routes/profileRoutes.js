const express = require("express");
const { supabase } = require("../config/supabase");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();
const VALID_ROLES = new Set(["client", "freelancer", "both"]);

function normalizeWallet(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

router.post("/profile", async (req, res) => {
  try {
    const { wallet_address, role, skills, bio, portfolio } = req.body;
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
      portfolio: portfolio || ""
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
      .select("wallet_address, role, skills, bio, portfolio")
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

    let query = supabase
      .from("users")
      .select("wallet_address, role, skills, bio, portfolio")
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
