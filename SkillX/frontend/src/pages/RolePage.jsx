import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { api } from "../services/api";

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

const PRESET_AVATARS = [
  { name: "Sleek Hexagon", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23c084fc"/><stop offset="100%" stop-color="%236366f1"/></linearGradient></defs><polygon points="50,12 88,34 88,78 50,97 12,78 12,34" fill="none" stroke="url(%23g1)" stroke-width="5" stroke-linejoin="round"/><polygon points="50,22 80,39 80,73 50,88 20,73 20,39" fill="none" stroke="url(%23g1)" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/></svg>` },
  { name: "Sleek Triangle", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f472b6"/><stop offset="100%" stop-color="%23db2777"/></linearGradient></defs><polygon points="50,15 88,82 12,82" fill="none" stroke="url(%23g2)" stroke-width="5" stroke-linejoin="round"/><polygon points="50,28 78,77 22,77" fill="none" stroke="url(%23g2)" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/></svg>` },
  { name: "Sleek Globe", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2360a5fa"/><stop offset="100%" stop-color="%232563eb"/></linearGradient></defs><circle cx="50" cy="50" r="36" fill="none" stroke="url(%23g3)" stroke-width="5"/><circle cx="50" cy="50" r="26" fill="none" stroke="url(%23g3)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.7"/><line x1="50" y1="14" x2="50" y2="86" stroke="url(%23g3)" stroke-width="1" opacity="0.5"/><line x1="14" y1="50" x2="86" y2="50" stroke="url(%23g3)" stroke-width="1" opacity="0.5"/></svg>` },
  { name: "Sleek Chip", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2334d399"/><stop offset="100%" stop-color="%23059669"/></linearGradient></defs><rect x="16" y="16" width="68" height="68" rx="10" fill="none" stroke="url(%23g4)" stroke-width="5"/><rect x="26" y="26" width="48" height="48" rx="6" fill="none" stroke="url(%23g4)" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.6"/></svg>` },
  { name: "Sleek Compass", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><path d="M50,12 L60,40 L88,50 L60,60 L50,88 L40,60 L12,50 L40,40 Z" fill="none" stroke="url(%23g5)" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="none" stroke="url(%23g5)" stroke-width="1.5" opacity="0.7"/></svg>` },
  { name: "Sleek Diamond", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fb923c"/><stop offset="100%" stop-color="%23ea580c"/></linearGradient></defs><polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="url(%23g6)" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="url(%23g6)" stroke-width="1.5" opacity="0.5"/><line x1="15" y1="50" x2="85" y2="50" stroke="url(%23g6)" stroke-width="1.5" opacity="0.5"/></svg>` }
];

export default function RolePage() {
  const { address, profile, hasProfile, updateProfile } = useWallet();
  const navigate = useNavigate();

  // Pre-fill from existing profile if available (edit mode)
  const [role, setRole] = useState("client");
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Cropper Modal States
  const [cropSrc, setCropSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const imageRef = useRef(null);

  // Populate form fields from existing profile
  useEffect(() => {
    if (profile) {
      setRole(profile.role || "client");
      setName(profile.name || "");
      setSkills(Array.isArray(profile.skills) ? profile.skills.join(", ") : "");
      setBio(profile.bio || "");
      setPortfolio(profile.portfolio || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  // Load image when cropSrc changes
  useEffect(() => {
    if (!cropSrc) return;
    const img = new Image();
    img.src = cropSrc;
    img.onload = () => {
      imageRef.current = img;
      setZoom(1);
      setPan({ x: 0, y: 0 });
      drawCanvas(img, 1, { x: 0, y: 0 });
    };
  }, [cropSrc]);

  // Redraw canvas when zoom or pan offsets change
  useEffect(() => {
    if (imageRef.current) {
      drawCanvas(imageRef.current, zoom, pan);
    }
  }, [zoom, pan]);

  const drawCanvas = (img, currentZoom, currentPan) => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scaleX = canvasWidth / img.width;
    const scaleY = canvasHeight / img.height;
    const baseScale = Math.max(scaleX, scaleY);

    const w = img.width * baseScale * currentZoom;
    const h = img.height * baseScale * currentZoom;

    const x = (canvasWidth - w) / 2 + currentPan.x;
    const y = (canvasHeight - h) / 2 + currentPan.y;

    ctx.drawImage(img, x, y, w, h);

    // Draw circular dark mask
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = 100;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
    ctx.fill();

    // Draw guidance border
    ctx.strokeStyle = "var(--primary)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  };

  const handleMouseDown = (e) => {
    if (!cropSrc) return;
    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !cropSrc) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = cropCanvasRef.current;
    if (!canvas || !imageRef.current) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 200;
    exportCanvas.height = 200;
    const exportCtx = exportCanvas.getContext("2d");

    // Clip circular boundary
    exportCtx.beginPath();
    exportCtx.arc(100, 100, 100, 0, Math.PI * 2);
    exportCtx.clip();

    // Crop box from center of 300x300 canvas
    exportCtx.drawImage(
      canvas,
      50, 
      50, 
      200, 
      200, 
      0, 
      0, 
      200, 
      200 
    );

    const croppedDataUrl = exportCanvas.toDataURL("image/jpeg", 0.85);
    setAvatarUrl(croppedDataUrl);
    setCropSrc(null); // Close modal
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropSrc(event.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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
        name,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bio,
        portfolio,
        avatar_url: avatarUrl
      });

      updateProfile(result.profile);
      setMessage("Profile saved! Redirecting...");

      setTimeout(() => {
        navigate("/profile", { replace: true });
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
        <div className="avatar-selection-section" style={{ gridColumn: "1 / -1" }}>
          <span style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
            Choose Profile Picture
          </span>
          <div className="avatar-preview-container">
            <div className="avatar-preview-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar Preview" onError={(e) => {
                  e.target.style.display = 'none';
                }} />
              ) : (
                <span className="avatar-preview-placeholder">👤</span>
              )}
            </div>
            <div className="avatar-input-panel">
              <div className="avatar-url-row">
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Paste custom image URL or select a preset..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ whiteSpace: "nowrap", padding: "0 1rem" }}
                >
                  Browse PC
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              <small style={{ display: "block", opacity: 0.7 }}>
                Paste a URL, choose a sleek preset below, or upload and crop any image from your computer.
              </small>
            </div>
          </div>

          <div className="avatar-presets-grid">
            {PRESET_AVATARS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={`avatar-preset-btn ${avatarUrl === preset.url ? "active" : ""}`}
                onClick={() => setAvatarUrl(preset.url)}
                title={preset.name}
              >
                <img src={preset.url} alt={preset.name} />
              </button>
            ))}
          </div>
        </div>

        <label style={{ gridColumn: "1 / -1" }}>
          Display Name / Company Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe or Acme Corp"
          />
        </label>

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

      {/* Cropper Modal Overlay */}
      {cropSrc && (
        <div className="cropper-modal-overlay">
          <div className="cropper-modal-content">
            <h4>Crop Profile Picture</h4>
            <div
              className="crop-canvas-wrapper"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              <canvas
                ref={cropCanvasRef}
                width={300}
                height={300}
                style={{ display: "block" }}
              />
            </div>
            
            <div className="cropper-controls">
              <div className="zoom-slider-row">
                <span>Zoom:</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>
              <div className="cropper-action-row">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setCropSrc(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCrop}
                  style={{ flex: 1 }}
                >
                  Crop &amp; Use
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
