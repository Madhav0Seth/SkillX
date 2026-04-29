import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { api } from "../services/api";

export default function RolePage() {
  const { address } = useWallet();
  const [role, setRole] = useState("client");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [message, setMessage] = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!address) {
      setMessage("Connect your wallet first.");
      return;
    }
    try {
      await api.createProfile({
        wallet_address: address,
        role,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bio,
        portfolio
      });
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(`Failed to save profile: ${error.message}`);
    }
  };

  return (
    <section>
      <h2>Select Role</h2>
      <form className="grid-form" onSubmit={saveProfile}>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="client">Client</option>
            <option value="freelancer">Freelancer</option>
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
        <button type="submit">Save Profile</button>
      </form>
      {message && <p className="status">{message}</p>}
    </section>
  );
}
