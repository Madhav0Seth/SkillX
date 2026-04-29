const express = require("express");
const { supabase } = require("../config/supabase");
const { badRequest, internalError } = require("../utils/http");

const router = express.Router();

router.post("/profile", async (req, res) => {
  try {
    const { wallet_address, role, skills, bio, portfolio } = req.body;

    if (!wallet_address || !role) {
      return badRequest(res, "wallet_address and role are required");
    }

    const payload = {
      wallet_address,
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

router.get("/freelancers", async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from("users")
      .select("wallet_address, role, skills, bio, portfolio")
      .eq("role", "freelancer");

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
