import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { api } from "../services/api";

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

export default function RolePage() {
  const { address, profile, hasProfile, updateProfile } = useWallet();
  const navigate = useNavigate();

  // Pre-fill from existing profile if available (edit mode)
  const [role, setRole] = useState("client");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form fields from existing profile
  useEffect(() => {
    if (profile) {
      setRole(profile.role || "client");
      setSkills(Array.isArray(profile.skills) ? profile.skills.join(", ") : "");
      setBio(profile.bio || "");
      setPortfolio(profile.portfolio || "");
    }
  }, [profile]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!address) {
      setMessage("Connect your wallet first.");
      return;
    }
    try {
      setSaving(true);
      const result = await api.createProfile({
        wallet_address: normalizeWallet(address),
        role,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bio,
        portfolio
      });

      // Sync the saved profile back into WalletContext
      updateProfile(result.profile);
      setMessage("Profile saved! Redirecting...");

      // Redirect to the appropriate dashboard after a brief delay
      setTimeout(() => {
        if (role === "client") navigate("/client", { replace: true });
        else if (role === "freelancer") navigate("/freelancer", { replace: true });
        else navigate("/home", { replace: true });
      }, 800);
    } catch (error) {
      setMessage(`Failed to save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>{hasProfile ? "Edit Profile" : "Set Up Your Profile"}</h2>
      {!hasProfile && (
        <p style={{ opacity: 0.7, marginBottom: "1rem" }}>
          Welcome! Complete your profile to get started on SkillX.
        </p>
      )}
      <form className="grid-form" onSubmit={saveProfile}>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="client">Client</option>
            <option value="freelancer">Freelancer</option>
            <option value="both">Both Client and Freelancer</option>
          </select>
        </label>
        <label>
          Skills (comma separated)
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="react, soroban, rust"
          />
        </label>
        <label>
          Bio
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label>
          Portfolio URL
          <input
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://portfolio.example"
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : hasProfile ? "Update Profile" : "Save Profile"}
        </button>
      </form>
      {message && <p className="status">{message}</p>}
    </section>
  );
}
