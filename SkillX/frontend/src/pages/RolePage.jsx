import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useWallet } from "../context/WalletContext";
import { isHttpUrl, normalizeWallet } from "../utils/wallet";

const EMPTY_PROFILE = { role: "client", name: "", skills: "", bio: "", portfolio: "", avatarUrl: "" };

function profileToForm(profile) {
  if (!profile) return EMPTY_PROFILE;
  return {
    role: profile.role || "client",
    name: profile.name || "",
    skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : "",
    bio: profile.bio || "",
    portfolio: profile.portfolio || "",
    avatarUrl: profile.avatar_url || "",
  };
}

export default function RolePage() {
  const { address, profile, hasProfile, updateProfile } = useWallet();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => profileToForm(profile));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(profileToForm(profile)), [profile]);

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!address) return setMessage("Connect your wallet first.");
    if (form.portfolio && !isHttpUrl(form.portfolio)) return setMessage("Portfolio URL must start with http:// or https://.");
    if (form.avatarUrl && !isHttpUrl(form.avatarUrl)) return setMessage("Avatar URL must start with http:// or https://.");
    try {
      setSaving(true);
      const result = await api.createProfile({
        wallet_address: normalizeWallet(address),
        role: form.role,
        name: form.name.trim(),
        skills: [...new Set(form.skills.split(",").map((skill) => skill.trim()).filter(Boolean))],
        bio: form.bio.trim(),
        portfolio: form.portfolio.trim(),
        avatar_url: form.avatarUrl.trim(),
      });
      updateProfile(result.profile);
      navigate("/profile", { replace: true });
    } catch (error) {
      setMessage(`Could not save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>{hasProfile ? "Edit Profile" : "Set Up Your Profile"}</h2>
      <p className="subtitle">Use publicly hosted image and portfolio URLs. Image uploads require a dedicated storage service and are intentionally not stored in the database.</p>
      <form className="grid-form" onSubmit={saveProfile}>
        <label>
          Role
          <select value={form.role} onChange={updateField("role")}>
            <option value="client">Client</option>
            <option value="freelancer">Freelancer</option>
            <option value="both">Client and Freelancer</option>
          </select>
        </label>
        <label>
          Display name
          <input value={form.name} onChange={updateField("name")} maxLength="120" placeholder="John Doe or Acme Corp" />
        </label>
        <label>
          Skills (comma-separated)
          <input value={form.skills} onChange={updateField("skills")} maxLength="2400" placeholder="react, soroban, rust" />
        </label>
        <label>
          Avatar URL (optional)
          <input type="url" value={form.avatarUrl} onChange={updateField("avatarUrl")} placeholder="https://example.com/avatar.jpg" />
        </label>
        <label>
          Bio
          <textarea value={form.bio} onChange={updateField("bio")} maxLength="2000" />
        </label>
        <label>
          Portfolio URL
          <input type="url" value={form.portfolio} onChange={updateField("portfolio")} placeholder="https://portfolio.example" />
        </label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : hasProfile ? "Update Profile" : "Save Profile"}</button>
      </form>
      {message && <p className="status" role="alert">{message}</p>}
    </section>
  );
}
