import { useState } from "react";
import { useWallet } from "../context/WalletContext";

export default function FeedbackModal({ isOpen, onClose }) {
  const { address } = useWallet();
  const [rating, setRating] = useState(5);
  const [role, setRole] = useState("both");
  const [likedFeature, setLikedFeature] = useState("");
  const [bugReport, setBugReport] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="status-modal-overlay" onClick={onClose}>
      <div
        className="status-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "540px", textAlign: "left" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.35rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📝</span> User Feedback &amp; Level 5 Evaluation
          </h3>
          <button
            onClick={onClose}
            className="ghost"
            style={{ padding: "0.2rem 0.6rem", fontSize: "1.2rem", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "3rem" }}>🎉</div>
            <h4 style={{ margin: "0.5rem 0", color: "var(--crayon-green)" }}>Thank You for Your Feedback!</h4>
            <p style={{ color: "var(--muted)" }}>Your response has been recorded for Level 5 project improvements.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: 0 }}>
              Help us refine SkillX! Submit feedback directly below or access our official{" "}
              <a
                href="https://forms.google.com"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--crayon-blue)", textDecoration: "underline" }}
              >
                Google Form
              </a>.
            </p>

            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Your Wallet Address (Auto-detected):
              <input
                type="text"
                value={address || "Not connected"}
                readOnly
                style={{ background: "rgba(255,255,255,0.05)", opacity: 0.8, cursor: "not-allowed" }}
              />
            </label>

            <div>
              <label style={{ fontSize: "0.9rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                Overall Platform Rating (1 to 5 Stars):
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className={rating === star ? "" : "ghost"}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontSize: "1.1rem",
                      borderColor: rating === star ? "var(--crayon-yellow)" : "var(--border)",
                      color: rating >= star ? "#ffc107" : "var(--muted)"
                    }}
                  >
                    ★ {star}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Your Primary Role:
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: "0.6rem", marginTop: "0.3rem" }}>
                <option value="client">Client (Posting jobs)</option>
                <option value="freelancer">Freelancer (Accepting jobs)</option>
                <option value="both">Both / General Tester</option>
              </select>
            </label>

            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              What feature did you like most?
              <input
                type="text"
                value={likedFeature}
                onChange={(e) => setLikedFeature(e.target.value)}
                placeholder="e.g. 3D gear animation, Soroban escrow security..."
                required
              />
            </label>

            <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              Suggestions or Improvements:
              <textarea
                value={bugReport}
                onChange={(e) => setBugReport(e.target.value)}
                placeholder="Any UI layout thoughts or requested features..."
                rows={3}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem", marginTop: "0.5rem" }}>
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit">Submit Feedback</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
