import { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

// ── Math & Projection helpers for 3D Gear Model ──
class Gear3D {
  constructor(cx, cy, cz, radius, teeth, color, rotSpeed, axisTiltY = 0, axisTiltX = 0) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.radius = radius;
    this.teeth = teeth;
    this.color = color;
    this.rotSpeed = rotSpeed;
    this.tiltY = axisTiltY;
    this.tiltX = axisTiltX;

    // Disintegration direction (gears fly off in different mechanical directions)
    const angle = Math.random() * Math.PI * 2;
    this.dx = Math.cos(angle) * 220;
    this.dy = Math.sin(angle) * 220;
    this.dz = (Math.random() - 0.5) * 300;

    // Pre-generate local geometry
    this.geometry = this.generateGeometry();
  }

  generateGeometry() {
    const geom = {
      hub: [],
      rim: [],
      spokes: []
    };

    const hubRadius = this.radius * 0.25;
    const teethSteps = this.teeth * 2;

    // 1. Hub Points (inner circle)
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      geom.hub.push({
        x: Math.cos(angle) * hubRadius,
        y: Math.sin(angle) * hubRadius,
        z: 0
      });
    }

    // 2. Rim Points (outer teeth)
    for (let i = 0; i < teethSteps; i++) {
      const angle = (i / teethSteps) * Math.PI * 2;
      const isTooth = i % 2 === 0;
      const r = isTooth ? this.radius * 1.15 : this.radius * 0.95;
      geom.rim.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        z: 0
      });
    }

    // 3. Spokes (lines from center to rim)
    const spokeCount = 6;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2;
      geom.spokes.push([
        { x: Math.cos(angle) * hubRadius, y: Math.sin(angle) * hubRadius, z: 0 },
        { x: Math.cos(angle) * this.radius * 0.95, y: Math.sin(angle) * this.radius * 0.95, z: 0 }
      ]);
    }

    return geom;
  }

  // Transform and project local points to world space
  getTransformedPoints(gearAngle, currentProgress) {
    const points = { hub: [], rim: [], spokes: [] };

    // Rotation & tilt matrices
    const cosR = Math.cos(gearAngle * this.rotSpeed);
    const sinR = Math.sin(gearAngle * this.rotSpeed);
    const cosTX = Math.cos(this.tiltX);
    const sinTX = Math.sin(this.tiltX);
    const cosTY = Math.cos(this.tiltY);
    const sinTY = Math.sin(this.tiltY);

    const transform = (p) => {
      // 1. Spin around gear axis
      let rx = p.x * cosR - p.y * sinR;
      let ry = p.y * cosR + p.x * sinR;
      let rz = p.z;

      // 2. Tilt X
      let yX = ry * cosTX - rz * sinTX;
      let zX = rz * cosTX + ry * sinTX;

      // 3. Tilt Y
      let xY = rx * cosTY - zX * sinTY;
      let zY = zX * cosTY + rx * sinTY;

      // 4. Translate by gear center + disintegrate shift
      return {
        x: xY + this.cx + this.dx * currentProgress,
        y: yX + this.cy + this.dy * currentProgress,
        z: zY + this.cz + this.dz * currentProgress
      };
    };

    points.hub = this.geometry.hub.map(transform);
    points.rim = this.geometry.rim.map(transform);
    points.spokes = this.geometry.spokes.map(s => s.map(transform));

    return points;
  }
}

export default function StartPage() {
  const { isConnected, connectWallet, loading, error, hasProfile, profileLoading, role } = useWallet();
  const canvasRef = useRef(null);
  const targetProgress = useRef(0);

  useEffect(() => {
    const handleWheel = (e) => {
      targetProgress.current = Math.max(
        0,
        Math.min(1, targetProgress.current + e.deltaY * 0.0015)
      );
    };

    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      targetProgress.current = Math.max(
        0,
        Math.min(1, targetProgress.current + deltaY * 0.005)
      );
      touchStartY = touchY;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // 3D Canvas Mechanical Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animationFrameId;
    let globalAngleX = 0.4; // Initial tilt to see 3D shape
    let globalAngleY = -0.5;
    let gearAngle = 0; // Local gear rotation angle
    let currentProgress = 0;

    // Create a complex interlocking gear system in 3D (rescaled to be larger)
    const gears = [
      new Gear3D(0, 0, 0, 160, 24, "purple", 0.8), // Main Drive Gear
      new Gear3D(230, 0, -35, 90, 12, "blue", -1.6, 0.2, 0.1), // Side Planetary Gear
      new Gear3D(-200, 140, 30, 110, 16, "pink", -1.2, -0.3, 0.2), // Upper Offset Gear
      new Gear3D(-60, -210, -60, 70, 10, "green", -1.8, 0.4, -0.4), // Top Bevel Gear
      new Gear3D(150, -150, 40, 60, 8, "orange", 2.2, -0.5, 0.5) // Intermediate Small Gear
    ];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const fov = 500;

      // Lerp scroll progress
      currentProgress += (targetProgress.current - currentProgress) * 0.07;

      // Continuous camera drift
      globalAngleX += 0.0015;
      globalAngleY += 0.0025;
      gearAngle += 0.015; // Speed of mechanical motion

      const cosGX = Math.cos(globalAngleX);
      const sinGX = Math.sin(globalAngleX);
      const cosGY = Math.cos(globalAngleY);
      const sinGY = Math.sin(globalAngleY);

      // Resolve CSS custom properties dynamically (Vite/HMR & theme updates)
      const computedStyles = getComputedStyle(canvas);
      const colorText = computedStyles.getPropertyValue("--text").trim() || "#ffffff";
      const colorPurple = computedStyles.getPropertyValue("--crayon-purple").trim() || "#d1b3ff";
      const colorBlue = computedStyles.getPropertyValue("--crayon-blue").trim() || "#b3f0ff";
      const colorPink = computedStyles.getPropertyValue("--crayon-pink").trim() || "#ffb3d9";
      const colorGreen = computedStyles.getPropertyValue("--crayon-green").trim() || "#b3ffd9";
      const colorOrange = computedStyles.getPropertyValue("--crayon-orange").trim() || "#ffd1a9";

      const resolveColor = (name) => {
        if (name === "purple") return colorPurple;
        if (name === "blue") return colorBlue;
        if (name === "pink") return colorPink;
        if (name === "green") return colorGreen;
        if (name === "orange") return colorOrange;
        return colorText;
      };

      // Define single project helper in render scope
      const project = (p) => {
        let y1 = p.y * cosGX - p.z * sinGX;
        let z1 = p.z * cosGX + p.y * sinGX;
        let x2 = p.x * cosGY - z1 * sinGY;
        let z2 = z1 * cosGY + p.x * sinGY;
        const scale = fov / (fov + z2);
        return {
          x: centerX + x2 * scale,
          y: centerY + y1 * scale,
          scale,
          z: z2
        };
      };

      // Render gears sorted by depth (Z-buffer hack)
      const gearDrawList = gears.map(gear => {
        const pts = gear.getTransformedPoints(gearAngle, currentProgress);
        
        // Depth-sort sorting key based on gear center point
        // Apply camera rotation to center to find depth
        let yCenter = gear.cy * cosGX - gear.cz * sinGX;
        let zCenter = gear.cz * cosGX + gear.cy * sinGX;
        let zWorldCenter = zCenter * cosGY + gear.cx * sinGY;

        return { gear, pts, zWorldCenter };
      });

      // Sort back-to-front (painter's algorithm)
      gearDrawList.sort((a, b) => b.zWorldCenter - a.zWorldCenter);

      // Draw mechanical components
      gearDrawList.forEach(({ gear, pts }) => {
        const hubProj = pts.hub.map(project);
        const rimProj = pts.rim.map(project);
        const spokesProj = pts.spokes.map(s => s.map(project));

        // Connect the center with axle pin (draw axle 3D column)
        const centerPt = project({
          x: gear.cx + gear.dx * currentProgress,
          y: gear.cy + gear.dy * currentProgress,
          z: gear.cz + gear.dz * currentProgress
        });

        // Draw Axle Pin
        ctx.beginPath();
        ctx.arc(centerPt.x, centerPt.y, 6 * centerPt.scale, 0, Math.PI * 2);
        ctx.fillStyle = colorText;
        ctx.globalAlpha = Math.max(0.1, 1 - currentProgress);
        ctx.fill();

        // 1. Draw Hub
        ctx.strokeStyle = resolveColor(gear.color);
        ctx.lineWidth = 2.5 * centerPt.scale;
        ctx.globalAlpha = Math.max(0.15, 1 - currentProgress * 0.7);
        ctx.beginPath();
        hubProj.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // 2. Draw Spokes
        spokesProj.forEach(spoke => {
          ctx.beginPath();
          ctx.moveTo(spoke[0].x, spoke[0].y);
          ctx.lineTo(spoke[1].x, spoke[1].y);
          ctx.stroke();
        });

        // 3. Draw Outer Gear Rim (with teeth)
        ctx.beginPath();
        rimProj.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // 4. If integrated, draw tooth face details (looks like blueprint)
        if (currentProgress < 0.5) {
          ctx.lineWidth = 1 * centerPt.scale;
          ctx.globalAlpha = (0.5 - currentProgress) * 0.8;
          for (let i = 0; i < rimProj.length; i += 2) {
            const nextIdx = (i + 1) % rimProj.length;
            ctx.beginPath();
            ctx.moveTo(hubProj[i % hubProj.length].x, hubProj[i % hubProj.length].y);
            ctx.lineTo(rimProj[nextIdx].x, rimProj[nextIdx].y);
            ctx.stroke();
          }
        }
      });

      // Draw drive belt connecting main gear and planetary gear if integrated
      if (currentProgress < 0.6) {
        const gearA = gearDrawList.find(g => g.gear.radius === 160);
        const gearB = gearDrawList.find(g => g.gear.radius === 90);

        if (gearA && gearB) {
          const ptA = project({
            x: gearA.gear.cx + gearA.gear.dx * currentProgress,
            y: gearA.gear.cy + gearA.gear.dy * currentProgress,
            z: gearA.gear.cz + gearA.gear.dz * currentProgress
          });
          const ptB = project({
            x: gearB.gear.cx + gearB.gear.dx * currentProgress,
            y: gearB.gear.cy + gearB.gear.dy * currentProgress,
            z: gearB.gear.cz + gearB.gear.dz * currentProgress
          });

          ctx.beginPath();
          ctx.moveTo(ptA.x, ptA.y);
          ctx.lineTo(ptB.x, ptB.y);
          ctx.strokeStyle = colorText;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = (0.6 - currentProgress) * 0.4;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // Take user straight to /home as soon as Freighter connects
  if (isConnected && !loading && !profileLoading) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="start-scroll-container">
      <canvas ref={canvasRef} className="start-3d-canvas" />

      <section className="start-gate">
        <div className="start-card pinned-gate-card">
          <h1 className="start-logo">SkillX</h1>
          <p style={{ fontSize: "1.2rem", fontWeight: 500 }}>
            Connect your Freighter wallet to enter the marketplace.
          </p>

          <button
            className="connect-btn"
            onClick={connectWallet}
            disabled={loading || profileLoading}
            style={{ fontSize: "1.25rem", padding: "0.8rem 2rem" }}
          >
            {loading || profileLoading ? "Connecting..." : "Connect Freighter"}
          </button>

          {error && <p className="status" style={{ color: "var(--crayon-red)" }}>{error}</p>}
          <small style={{ fontSize: "0.95rem" }}>
            Wallet authentication is secured on-chain.
          </small>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/marketplace" className="btn-link ghost" style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}>
              Explore Marketplace
            </Link>
            <Link to="/docs" className="btn-link ghost" style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}>
              Documentation
            </Link>
          </div>
        </div>

        {/* Floating scroll action hint */}
        <div className="scroll-indicator-container">
          <span className="scroll-arrow">↓</span>
          <span className="scroll-text">Scroll anywhere to disintegrate gears</span>
          <span className="scroll-arrow">↓</span>
        </div>
      </section>
    </div>
  );
}
