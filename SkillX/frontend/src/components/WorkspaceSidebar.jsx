export default function WorkspaceSidebar({ label, items, activeId, onChange, isOpen, onToggle }) {
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-topbar">
        {isOpen && <span className="workspace-sidebar-heading">{label}</span>}
        <button
          type="button"
          className="workspace-sidebar-toggle"
          onClick={onToggle}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={isOpen}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      <nav className="workspace-sidebar-nav" aria-label={label}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`workspace-sidebar-item ${activeId === item.id ? "active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              onChange(item.id);
            }}
            aria-current={activeId === item.id ? "page" : undefined}
          >
            <span className="workspace-sidebar-icon">{item.icon}</span>
            <span className="workspace-sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
