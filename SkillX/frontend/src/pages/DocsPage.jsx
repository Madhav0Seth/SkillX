import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

// Clean SVG Icons (strictly no emojis)
const Icons = {
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Copy: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Check: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Book: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Code: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Terminal: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Server: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  Database: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  ExternalLink: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

function CodeSnippet({ code, language = "bash" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="docs-code-container">
      <div className="docs-code-header">
        <span className="docs-code-lang">{language}</span>
        <button
          type="button"
          className="docs-code-copy-btn"
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : "Copy code"}
        >
          {copied ? (
            <>
              <Icons.Check />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Icons.Copy />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="docs-code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const SECTIONS = [
  { id: "overview", label: "Overview & Architecture", group: "General" },
  { id: "features", label: "Core Features", group: "General" },
  { id: "workflow", label: "User Workflow Guide", group: "Guides" },
  { id: "setup", label: "Setup & Local Development", group: "Guides" },
  { id: "contracts", label: "Smart Contracts Reference", group: "Technical" },
  { id: "api", label: "REST API Reference", group: "Technical" },
  { id: "database", label: "Database Schema", group: "Technical" },
  { id: "security", label: "Security & Testing", group: "Technical" },
];

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const topOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="docs-layout">
      {/* Sidebar Navigation */}
      <aside className="docs-sidebar" aria-label="Documentation Navigation">
        <div className="docs-sidebar-header">
          <span className="docs-badge">Documentation</span>
          <h2>SkillX Docs</h2>
          <p className="docs-sidebar-sub">Decentralized Freelance Protocol</p>
        </div>

        <div className="docs-search-box">
          <span className="docs-search-icon" aria-hidden="true">
            <Icons.Search />
          </span>
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter documentation sections"
          />
          {searchQuery && (
            <button
              type="button"
              className="docs-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              x
            </button>
          )}
        </div>

        <nav className="docs-nav">
          {["General", "Guides", "Technical"].map((groupName) => {
            const groupItems = filteredSections.filter(
              (s) => s.group === groupName
            );
            if (groupItems.length === 0) return null;
            return (
              <div key={groupName} className="docs-nav-group">
                <span className="docs-nav-group-title">{groupName}</span>
                <ul>
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`docs-nav-link ${
                          activeSection === item.id ? "active" : ""
                        }`}
                        onClick={() => scrollToSection(item.id)}
                      >
                        <span className="docs-nav-indicator" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="docs-sidebar-footer">
          <div className="docs-sidebar-links">
            <Link to="/marketplace">Public Marketplace</Link>
            <Link to="/roadmap">Feedback & Roadmap</Link>
          </div>
          <span className="docs-network-pill">Stellar Testnet v20</span>
        </div>
      </aside>

      {/* Main Documentation Content */}
      <main className="docs-main-content">
        {/* Top Hero Banner */}
        <header className="docs-hero">
          <div className="docs-hero-inner">
            <span className="home-kicker">Developer & User Manual</span>
            <h1>SkillX Technical Documentation</h1>
            <p>
              Complete documentation covering the platform architecture, smart
              contract interfaces, REST API endpoints, local setup guides, and
              end-to-end milestone workflows.
            </p>
            <div className="docs-quick-links">
              <button
                type="button"
                className="docs-quick-btn"
                onClick={() => scrollToSection("workflow")}
              >
                <Icons.Book /> Workflow Guide
              </button>
              <button
                type="button"
                className="docs-quick-btn"
                onClick={() => scrollToSection("contracts")}
              >
                <Icons.Code /> Smart Contracts
              </button>
              <button
                type="button"
                className="docs-quick-btn"
                onClick={() => scrollToSection("api")}
              >
                <Icons.Server /> REST API
              </button>
              <button
                type="button"
                className="docs-quick-btn"
                onClick={() => scrollToSection("setup")}
              >
                <Icons.Terminal /> Setup Guide
              </button>
            </div>
          </div>
        </header>

        {/* Section 1: Overview & Architecture */}
        <section id="overview" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Architecture</span>
            <h2>1. Overview and System Architecture</h2>
          </div>
          <p>
            SkillX is a trustless, decentralized freelance marketplace built on{" "}
            <strong>Stellar Testnet</strong> using <strong>Soroban</strong> smart
            contracts. It connects clients and freelancers via non-custodial
            milestone escrow, transparent reputation tracking, and indexed job
            discovery.
          </p>

          <div className="docs-card-grid">
            <div className="docs-card">
              <div className="docs-card-icon">
                <Icons.Layers />
              </div>
              <h3>Hybrid On-Chain / Off-Chain Design</h3>
              <p>
                Financial custody, milestone state machines, and reputation metrics
                are enforced immutably on Stellar Soroban. Search indexing,
                rich descriptions, and portfolio assets reside in Supabase.
              </p>
            </div>
            <div className="docs-card">
              <div className="docs-card-icon">
                <Icons.Shield />
              </div>
              <h3>Non-Custodial Escrow</h3>
              <p>
                Client funds are locked directly in the Soroban Escrow Contract.
                Neither SkillX nor any centralized intermediary can divert deposits.
                Payment release requires client authorization upon delivery.
              </p>
            </div>
            <div className="docs-card">
              <div className="docs-card-icon">
                <Icons.Database />
              </div>
              <h3>Integrity Anchoring</h3>
              <p>
                Off-chain job specifications and milestone criteria are hashed
                (SHA-256) and permanently stored in the contract state to ensure
                data tamper-resistance.
              </p>
            </div>
          </div>

          <h3>System Architecture Diagram</h3>
          <div className="docs-arch-box">
            <div className="docs-arch-layer docs-arch-frontend">
              <strong>Frontend Layer (React + Vite)</strong>
              <span>Freighter Wallet Integration &bull; Responsive Client & Freelancer Desks</span>
            </div>
            <div className="docs-arch-connector">&darr; Dual Dispatch &darr;</div>
            <div className="docs-arch-split">
              <div className="docs-arch-column">
                <strong>Backend Indexer (Express + Node.js)</strong>
                <span>Supabase PostgreSQL &bull; Fast Search &bull; Portfolio Profiles</span>
              </div>
              <div className="docs-arch-column docs-arch-stellar">
                <strong>Stellar Network (Soroban Contracts)</strong>
                <span>Escrow &bull; Job Manager &bull; Milestone Manager &bull; Reputation</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Features */}
        <section id="features" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Capabilities</span>
            <h2>2. Core Platform Features</h2>
          </div>

          <div className="docs-table-wrapper">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Component</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Milestone Escrow</strong></td>
                  <td>Escrow & Milestone Contracts</td>
                  <td>Allows multi-phase jobs with distinct percentage allocations. Payments are locked in advance and released per milestone.</td>
                </tr>
                <tr>
                  <td><strong>Public Marketplace</strong></td>
                  <td>Frontend + Express API</td>
                  <td>Unauthenticated visitors can browse all active job listings, filter by skills, and inspect milestone structures.</td>
                </tr>
                <tr>
                  <td><strong>Dual-Role Profiles</strong></td>
                  <td>Wallet Context + Database</td>
                  <td>Users can register as a Client, Freelancer, or Dual-Role with a single Stellar wallet address.</td>
                </tr>
                <tr>
                  <td><strong>Deliverable Proof</strong></td>
                  <td>Milestones & Submissions</td>
                  <td>Freelancers submit proof links and documentation notes. Clients review work directly before signing approval transactions.</td>
                </tr>
                <tr>
                  <td><strong>On-Chain Reputation</strong></td>
                  <td>Reputation Contract</td>
                  <td>Automatically tracks completed jobs, total XLM settled, and client rating averages without platform lock-in.</td>
                </tr>
                <tr>
                  <td><strong>Single-Click Setup Flow</strong></td>
                  <td>Client Dashboard</td>
                  <td>Consolidates job creation, milestone configuration, and escrow deposit into an intuitive, guided transaction workflow.</td>
                </tr>
                <tr>
                  <td><strong>Community Feedback</strong></td>
                  <td>Feedback Module</td>
                  <td>Publicly tracks community feature requests, development statuses, and feedback submissions.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Workflow */}
        <section id="workflow" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Guide</span>
            <h2>3. User Workflow Guide</h2>
          </div>

          <div className="docs-timeline">
            <div className="docs-timeline-step">
              <div className="docs-timeline-num">01</div>
              <div className="docs-timeline-content">
                <h3>Wallet Connection and Role Setup</h3>
                <p>
                  Install the <strong>Freighter Wallet</strong> extension. Switch network to <strong>Stellar Testnet</strong> and fund your wallet with test XLM via Stellar Friendbot. Connect your wallet to SkillX and choose your role (Client, Freelancer, or Both) while adding skills, portfolio URLs, and bio.
                </p>
              </div>
            </div>

            <div className="docs-timeline-step">
              <div className="docs-timeline-num">02</div>
              <div className="docs-timeline-content">
                <h3>Client: Post Job and Lock Escrow</h3>
                <p>
                  Navigate to the Client Desk and click <strong>Create Job</strong>. Specify the project title, description, required skill tags, and total budget in XLM. Divide the project into one or more sequential milestones with percentage allocations (totalling 100%). Approve the transaction in Freighter to lock funds in the Escrow Contract.
                </p>
              </div>
            </div>

            <div className="docs-timeline-step">
              <div className="docs-timeline-num">03</div>
              <div className="docs-timeline-content">
                <h3>Freelancer: Discover and Accept Job</h3>
                <p>
                  Freelancers browse the public or dashboard marketplace, filter jobs by matching skill tags, review deliverables and milestone payouts, and accept the contract. Acceptance updates the job status on-chain to <code>InProgress</code>.
                </p>
              </div>
            </div>

            <div className="docs-timeline-step">
              <div className="docs-timeline-num">04</div>
              <div className="docs-timeline-content">
                <h3>Freelancer: Submit Milestone Work</h3>
                <p>
                  As milestone tasks are finished, the freelancer inputs repository URLs, design preview links, or deliverable summaries and clicks <strong>Submit Milestone</strong>. This transitions the milestone status on-chain to <code>Submitted</code> and notifies the client.
                </p>
              </div>
            </div>

            <div className="docs-timeline-step">
              <div className="docs-timeline-num">05</div>
              <div className="docs-timeline-content">
                <h3>Client: Review and Release Payment</h3>
                <p>
                  The client reviews the submission from their dashboard. Upon clicking <strong>Approve Milestone</strong>, a Soroban transaction invokes the Milestone Manager, which authorizes the Escrow Contract to release the designated XLM fraction directly to the freelancer's wallet.
                </p>
              </div>
            </div>

            <div className="docs-timeline-step">
              <div className="docs-timeline-num">06</div>
              <div className="docs-timeline-content">
                <h3>Completion and Reputation Update</h3>
                <p>
                  When all milestones are approved and paid, the job transitions to <code>Completed</code>. The Reputation Contract records the successful delivery, and the client may submit an on-chain rating.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Setup & Local Development */}
        <section id="setup" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Deployment</span>
            <h2>4. Setup and Local Development</h2>
          </div>

          <h3>Prerequisites</h3>
          <ul className="docs-list">
            <li><strong>Node.js</strong> (v18.0.0 or higher) and <strong>npm</strong></li>
            <li><strong>Rust toolchain</strong> (v1.74.0 or higher) with target <code>wasm32-unknown-unknown</code></li>
            <li><strong>Stellar Soroban CLI</strong> (v20.0 or higher)</li>
            <li><strong>Supabase</strong> project (PostgreSQL database)</li>
            <li><strong>Freighter Browser Extension</strong> configured for Stellar Testnet</li>
          </ul>

          <h3>1. Backend Setup</h3>
          <p>Navigate to the backend directory, install packages, configure environment variables, and start the development server:</p>
          <CodeSnippet
            language="bash"
            code={`cd SkillX/backend
npm install
cp .env.example .env`}
          />
          <p>Edit <code>SkillX/backend/.env</code> with your credentials:</p>
          <CodeSnippet
            language="env"
            code={`PORT=4000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CORS_ORIGIN=http://localhost:5173`}
          />
          <p>Execute the database schema migration by running the contents of <code>SkillX/backend/supabase-schema.sql</code> in your Supabase SQL Editor.</p>
          <CodeSnippet
            language="bash"
            code={`npm run dev`}
          />

          <h3>2. Frontend Setup</h3>
          <p>Navigate to the frontend directory, install dependencies, and configure testnet environment variables:</p>
          <CodeSnippet
            language="bash"
            code={`cd SkillX/frontend
npm install
cp .env.example .env`}
          />
          <p>Populate <code>SkillX/frontend/.env</code>:</p>
          <CodeSnippet
            language="env"
            code={`VITE_API_BASE_URL=http://localhost:4000
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_ESCROW_CONTRACT_ID=CCPSEXCCYNIEYIDHZA774T6WQM3KXTLTETOI762G4USMTYFZXTVJKI4B
VITE_JOB_MANAGER_CONTRACT_ID=CB7YQMFJIKEEK3G4554JGDH3EIKJY3VN4ZT7CSDEKLH6WCECOV727IWC
VITE_MILESTONE_MANAGER_CONTRACT_ID=CDSVTVOJET5YEVYXDOUHCQKA7C7PBSSYFMM3HS4NQVX3EAWCZIZWZMZ4
VITE_XLM_SAC_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`}
          />
          <CodeSnippet
            language="bash"
            code={`npm run dev`}
          />

          <h3>3. Smart Contract Compilation and Tests</h3>
          <p>Compile all four Soroban Rust contracts to WebAssembly and run unit tests:</p>
          <CodeSnippet
            language="bash"
            code={`cargo build --target wasm32-unknown-unknown --release
cargo test -p escrow-contract
cargo test -p job-manager-contract
cargo test -p milestone-manager-contract
cargo test -p reputation-contract`}
          />
        </section>

        {/* Section 5: Smart Contracts Reference */}
        <section id="contracts" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Soroban</span>
            <h2>5. Smart Contracts Reference</h2>
          </div>

          <p>SkillX deploys four interconnected smart contracts on Stellar Testnet:</p>

          <div className="docs-table-wrapper">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Stellar Testnet ID</th>
                  <th>Responsibility</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>EscrowContract</strong></td>
                  <td><code className="docs-address-code">CCPSEXCCYNIEYIDHZA774T6WQM3KXTLTETOI762G4USMTYFZXTVJKI4B</code></td>
                  <td>Holds XLM tokens in escrow; releases funds on milestone approvals or issues refunds.</td>
                </tr>
                <tr>
                  <td><strong>JobManagerContract</strong></td>
                  <td><code className="docs-address-code">CB7YQMFJIKEEK3G4554JGDH3EIKJY3VN4ZT7CSDEKLH6WCECOV727IWC</code></td>
                  <td>Maintains top-level job state (Open, InProgress, Completed, Cancelled) and client/freelancer identities.</td>
                </tr>
                <tr>
                  <td><strong>MilestoneManagerContract</strong></td>
                  <td><code className="docs-address-code">CDSVTVOJET5YEVYXDOUHCQKA7C7PBSSYFMM3HS4NQVX3EAWCZIZWZMZ4</code></td>
                  <td>Tracks per-milestone progress, integrity hashes, percentages, submission state, and triggers escrow payouts.</td>
                </tr>
                <tr>
                  <td><strong>ReputationContract</strong></td>
                  <td><code className="docs-address-code">CAKQDKSSNVVBLBCHHL22Q3PDZ6VDGAUM2ERND4OKJ2VCL6JDDL4YZSUN</code></td>
                  <td>Stores completed job counts, volume settled, on-time delivery metrics, and client rating history.</td>
                </tr>
                <tr>
                  <td><strong>XLM SAC (Native)</strong></td>
                  <td><code className="docs-address-code">CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC</code></td>
                  <td>Stellar Asset Contract wrapping native XLM for Soroban token operations.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Contract Function Signatures</h3>

          <div className="docs-contract-card">
            <h4>EscrowContract Functions</h4>
            <div className="docs-fn-spec">
              <code>initialize(env: Env, job_manager: Address, milestone_manager: Address, token_id: Address)</code>
              <p>One-time initialization configuring authorized callers and token contract.</p>
            </div>
            <div className="docs-fn-spec">
              <code>deposit(env: Env, job_id: BytesN&lt;32&gt;, client: Address, amount: i128)</code>
              <p>Transfers native XLM from client to escrow contract and locks balance for job_id.</p>
            </div>
            <div className="docs-fn-spec">
              <code>release_payment(env: Env, job_id: BytesN&lt;32&gt;, freelancer: Address, amount: i128)</code>
              <p>Invoked by MilestoneManagerContract to transfer milestone payout to freelancer.</p>
            </div>
            <div className="docs-fn-spec">
              <code>refund(env: Env, job_id: BytesN&lt;32&gt;, client: Address)</code>
              <p>Invoked by JobManagerContract to return remaining escrow balance to client upon cancellation.</p>
            </div>
          </div>

          <div className="docs-contract-card">
            <h4>JobManagerContract Functions</h4>
            <div className="docs-fn-spec">
              <code>create_job(env: Env, job_id: BytesN&lt;32&gt;, job_hash: BytesN&lt;32&gt;, client: Address, total_amount: i128)</code>
              <p>Registers a new job record on-chain with status <code>JobStatus::Open</code>.</p>
            </div>
            <div className="docs-fn-spec">
              <code>accept_job(env: Env, job_id: BytesN&lt;32&gt;, freelancer: Address)</code>
              <p>Assigns freelancer to the job and updates status to <code>JobStatus::InProgress</code>.</p>
            </div>
            <div className="docs-fn-spec">
              <code>cancel_job(env: Env, job_id: BytesN&lt;32&gt;, caller: Address)</code>
              <p>Cancels an unaccepted job and triggers full escrow refund to client.</p>
            </div>
          </div>

          <div className="docs-contract-card">
            <h4>MilestoneManagerContract Functions</h4>
            <div className="docs-fn-spec">
              <code>create_milestones(env: Env, job_id: BytesN&lt;32&gt;, client: Address, freelancer: Address, total_amount: i128, milestones: Vec&lt;Milestone&gt;)</code>
              <p>Registers milestone sequence, percentage allocations, and deadlines for a job.</p>
            </div>
            <div className="docs-fn-spec">
              <code>submit_milestone(env: Env, job_id: BytesN&lt;32&gt;, milestone_index: u32, freelancer: Address)</code>
              <p>Transitions milestone status to <code>MilestoneStatus::Submitted</code>.</p>
            </div>
            <div className="docs-fn-spec">
              <code>approve_milestone(env: Env, job_id: BytesN&lt;32&gt;, milestone_index: u32, client: Address)</code>
              <p>Validates client signature, marks milestone <code>Paid</code>, and executes escrow release.</p>
            </div>
          </div>
        </section>

        {/* Section 6: REST API Reference */}
        <section id="api" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">HTTP Endpoints</span>
            <h2>6. REST API Reference</h2>
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag get">GET</span>
              <code>/health</code>
            </div>
            <p>System health check and database connectivity probe.</p>
            <CodeSnippet
              language="json"
              code={`// Response 200 OK
{
  "status": "ok",
  "service": "skillx-backend",
  "timestamp": "2026-08-28T15:00:00.000Z"
}`}
            />
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag get">GET</span>
              <code>/profile?wallet_address=&lt;STELLAR_PUBKEY&gt;</code>
            </div>
            <p>Fetches a user profile, roles, skills, portfolio links, and reputation statistics.</p>
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag post">POST</span>
              <code>/profile</code>
            </div>
            <p>Creates or updates a user profile.</p>
            <CodeSnippet
              language="json"
              code={`// Request Body
{
  "wallet_address": "GB7B...3K9Q",
  "role": "both", // "client" | "freelancer" | "both"
  "name": "Jane Doe",
  "bio": "Full-stack Web3 engineer specializing in Rust and React",
  "avatar_url": "https://example.com/avatar.jpg",
  "skills": ["Rust", "React", "Soroban", "TypeScript"],
  "portfolio_links": ["https://github.com/janedoe", "https://janedoe.dev"]
}`}
            />
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag get">GET</span>
              <code>/jobs?scope=open&amp;skill=Rust&amp;limit=20</code>
            </div>
            <p>Lists marketplace jobs filtered by status (<code>open</code>, <code>assigned</code>), client wallet, freelancer wallet, or skill tag.</p>
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag post">POST</span>
              <code>/job</code>
            </div>
            <p>Stores off-chain job metadata and milestone breakdowns in Supabase.</p>
            <CodeSnippet
              language="json"
              code={`// Request Body
{
  "client_wallet": "GB7B...3K9Q",
  "title": "Build Soroban Escrow Integration",
  "description": "Implement automated escrow payment releases for freelance milestones.",
  "total_budget": 500,
  "skills": ["Rust", "Soroban", "React"],
  "milestones": [
    {
      "description": "Milestone 1: Smart contract implementation",
      "percentage": 50,
      "amount": 250,
      "deadline": 1780000000
    },
    {
      "description": "Milestone 2: Frontend integration & testing",
      "percentage": 50,
      "amount": 250,
      "deadline": 1781000000
    }
  ]
}`}
            />
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag post">POST</span>
              <code>/job/:jobId/accept</code>
            </div>
            <p>Associates a freelancer with an open job listing.</p>
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag post">POST</span>
              <code>/submit</code>
            </div>
            <p>Records deliverable proof links and notes for a specific milestone.</p>
            <CodeSnippet
              language="json"
              code={`// Request Body
{
  "milestone_id": 42,
  "freelancer_wallet": "GA6C...4M1Z",
  "deliverable_url": "https://github.com/user/project-pull-request",
  "notes": "Completed milestone unit tests and contract integration."
}`}
            />
          </div>

          <div className="docs-api-endpoint">
            <div className="docs-api-header">
              <span className="docs-method-tag post">POST</span>
              <code>/milestone/:milestoneId/approve</code>
            </div>
            <p>Marks off-chain milestone state as approved following on-chain payment release.</p>
          </div>
        </section>

        {/* Section 7: Database Schema */}
        <section id="database" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">PostgreSQL</span>
            <h2>7. Database Schema</h2>
          </div>

          <div className="docs-table-wrapper">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Primary Key</th>
                  <th>Key Columns</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>users</code></td>
                  <td><code>wallet_address</code></td>
                  <td>role, name, bio, avatar_url, skills (text[]), portfolio_links (text[]), created_at</td>
                </tr>
                <tr>
                  <td><code>jobs</code></td>
                  <td><code>job_id</code></td>
                  <td>client_wallet, freelancer_wallet, title, description, total_budget, status, job_hash, skills (text[]), created_at</td>
                </tr>
                <tr>
                  <td><code>milestones</code></td>
                  <td><code>milestone_id</code></td>
                  <td>job_id, milestone_index, description, percentage, amount, deadline, status, created_at</td>
                </tr>
                <tr>
                  <td><code>submissions</code></td>
                  <td><code>submission_id</code></td>
                  <td>milestone_id, freelancer_wallet, deliverable_url, notes, submitted_at</td>
                </tr>
                <tr>
                  <td><code>feedback</code></td>
                  <td><code>id</code></td>
                  <td>wallet_address, feedback_text, rating, created_at</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 8: Security & Testing */}
        <section id="security" className="docs-section">
          <div className="docs-section-heading">
            <span className="docs-section-tag">Quality Assurance</span>
            <h2>8. Security and Testing</h2>
          </div>

          <div className="docs-card-grid">
            <div className="docs-card">
              <h3>Smart Contract Authorization</h3>
              <p>
                Every state modification checks <code>require_auth()</code> for the appropriate party (client or freelancer). Cross-contract payouts from the Escrow Contract are restricted exclusively to the registered Milestone Manager Contract address.
              </p>
            </div>
            <div className="docs-card">
              <h3>Comprehensive Test Coverage</h3>
              <p>
                Rust unit tests cover full execution lifecycles: single and multi-milestone payouts, unauthorized caller rejections, over-allocation prevention, and cancellation refund invariants.
              </p>
            </div>
            <div className="docs-card">
              <h3>Non-Custodial Guarantee</h3>
              <p>
                Neither admin keys nor backend servers possess private custody of client deposits. Escrow funds can only be directed to the designated freelancer upon explicit client signature or refunded upon cancellation.
              </p>
            </div>
          </div>

          <h3>Running the Test Suite</h3>
          <CodeSnippet
            language="bash"
            code={`# Test all four smart contracts
cd SkillX
cargo test

# Validate frontend production build
cd frontend
npm run build`}
          />
        </section>

        {/* Bottom CTA / Help */}
        <div className="docs-footer-cta">
          <div className="docs-footer-cta-copy">
            <h3>Ready to explore SkillX?</h3>
            <p>Visit the public marketplace or test the milestone escrow workflow on Stellar Testnet.</p>
          </div>
          <div className="docs-footer-cta-actions">
            <Link to="/marketplace" className="btn-link home-primary-action">
              Browse Marketplace
            </Link>
            <Link to="/roadmap" className="btn-link ghost">
              View Roadmap
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
