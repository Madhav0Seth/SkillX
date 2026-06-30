import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ProfilePopup from "./ProfilePopup";

export default function UserHoverCard({ walletAddress, name, avatarUrl, children }) {
  const [showPopup, setShowPopup] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimeout = useRef(null);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHovered(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHovered(false), 300);
  }, []);

  if (!walletAddress) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        className="user-hover-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
        <span className={`user-hover-badge ${hovered ? "user-hover-badge--visible" : ""}`}>
          <button
            className="user-hover-view-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setHovered(false);
              setShowPopup(true);
            }}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Profile
          </button>
        </span>
      </span>

      {showPopup && createPortal(
        <ProfilePopup
          walletAddress={walletAddress}
          onClose={() => setShowPopup(false)}
        />,
        document.body
      )}
    </>
  );
}
