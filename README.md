# SkillX

[![CI](https://github.com/Madhav0Seth/SkillX/actions/workflows/ci.yml/badge.svg)](https://github.com/Madhav0Seth/SkillX/actions/workflows/ci.yml)

**SkillX** is a decentralized freelance marketplace on **Stellar Testnet**. It combines a polished React experience with Soroban smart contracts so clients can fund milestone escrow, freelancers can submit work, and payments are released after approval.

## Links

| Resource | Link |
| --- | --- |
| Live app | [skill-x-nu.vercel.app](https://skill-x-nu.vercel.app/) |
| Public marketplace | [Browse open jobs](https://skill-x-nu.vercel.app/marketplace) |
| Backend API | [skillx-tqzb.onrender.com](https://skillx-tqzb.onrender.com) |
| Feedback form | [SkillX User Feedback Form](https://docs.google.com/forms/d/e/1FAIpQLSffAdXqPWPjtufDt_UxySfMGKZCTgQSbW9UiDb0Wv4VFNiFYg/viewform?usp=publish-editor) |
| Demo | [YouTube walkthrough](https://www.youtube.com/watch?v=SfhH32hAEAw) |

> **Screenshots and product images are being refreshed soon.** Their update is tracked separately and does not block using or reviewing the application.

## Highlights

- **Decentralized marketplace:** discover open work, create jobs, and connect clients with freelancers.
- **Stellar + Soroban:** escrow, job, milestone, and reputation contracts are deployed on Stellar Testnet.
- **Milestone escrow workflow:** create a job, fund escrow, accept work, submit milestones, approve delivery, and release payment.
- **Profiles and discovery:** roles, skills, portfolios, avatars, activity stats, reputation badges, freelancer browsing, and skill-based job filtering.
- **Responsive dashboards:** dedicated client and freelancer workflows with mobile-friendly layouts and refresh feedback.
- **Notifications and transaction UX:** milestone-submission notifications, loading states, actionable errors, and transaction status links.
- **Full-stack foundation:** React + Vite frontend, Express API, Supabase persistence, and Rust/Soroban contracts.
- **UX polish:** public marketplace access, in-app feedback collection, themed feedback status icons, and a logged-in HomePage SkillX handwriting animation.

## How it works

1. Connect a Freighter wallet on Stellar Testnet and create a client, freelancer, or dual-role profile.
2. A client creates a job with optional skills and one or more milestones, then funds escrow.
3. A freelancer discovers and accepts the job, then submits milestone work.
4. The client is notified, reviews the submission, and approves the milestone.
5. Soroban escrow releases the approved payment; dashboard and profile activity refresh to reflect the new state.

## Feedback-driven improvements

The in-app [Feedback & Product Roadmap](/SkillX/frontend/src/pages/FeedbackRoadmapPage.jsx) tracks seven community requests. Status below reflects the implemented application code and roadmap entries.

| Feedback item | Status | Current outcome |
| --- | --- | --- |
| Reduce unnecessary wallet transactions and improve sync reliability | **Implemented** | Key job and milestone actions use consolidated on-chain flows and dashboard refresh UX. |
| Notify clients when a milestone is submitted for approval | **Implemented** | Milestone submission notifications are available in the client workflow. |
| Make job posting, escrow funding, and milestone setup feel like one flow | **Implemented** | The job creation flow combines setup and escrow-oriented actions. |
| Add direct communication between client and freelancer on a job | **Under review** | Tracked as an open roadmap request; no chat feature is claimed. |
| Add skill-based marketplace filtering for better job discovery | **Implemented** | Jobs support optional skills and marketplace filtering. |
| Show clearer, actionable errors when a transaction or sync is blocked | **Implemented** | Transaction and sync feedback has been improved. |
| Add wallet transaction loading states | **Implemented** | Wallet actions expose loading feedback. |

Feedback can be submitted through the [SkillX User Feedback Form](https://docs.google.com/forms/d/e/1FAIpQLSffAdXqPWPjtufDt_UxySfMGKZCTgQSbW9UiDb0Wv4VFNiFYg/viewform?usp=publish-editor) or the in-app feedback experience.

## Architecture

```text
React + Vite + Freighter
        │
        ├── Express API ── Supabase (profiles, jobs, milestones, submissions)
        │
        └── Stellar Soroban ── Job Manager, Milestone Manager, Escrow, Reputation
```

On-chain contracts manage lifecycle state, escrow balances, and payment rules. Supabase stores readable marketplace data such as profiles, skills, job details, and submission URLs.

## Repository structure

```text
SkillX/
├── frontend/       # React + Vite application
├── backend/        # Express + Supabase API
├── contracts/      # Rust/Soroban contracts
│   ├── escrow/
│   ├── job_manager/
│   ├── milestone_manager/
│   └── reputation/
└── Cargo.toml
```

## Local setup

### Prerequisites

- Node.js and npm
- Rust and Cargo
- A Supabase project
- Freighter browser extension and funded Stellar Testnet wallets for on-chain flows

### 1. Configure and run the backend

```bash
cd SkillX/backend
npm install
npm run dev
```

Create `SkillX/backend/.env`:

```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# Optional for deployed clients; defaults to http://localhost:5173 in development
CORS_ORIGIN=http://localhost:5173
```

Run `SkillX/backend/supabase-schema.sql` in the Supabase SQL editor before using the API.

### 2. Configure and run the frontend

```bash
cd SkillX/frontend
npm install
npm run dev
```

Create `SkillX/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_ESCROW_CONTRACT_ID=CCPSEXCCYNIEYIDHZA774T6WQM3KXTLTETOI762G4USMTYFZXTVJKI4B
VITE_JOB_MANAGER_CONTRACT_ID=CB7YQMFJIKEEK3G4554JGDH3EIKJY3VN4ZT7CSDEKLH6WCECOV727IWC
VITE_MILESTONE_MANAGER_CONTRACT_ID=CDSVTVOJET5YEVYXDOUHCQKA7C7PBSSYFMM3HS4NQVX3EAWCZIZWZMZ4
VITE_XLM_SAC_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

### 3. Verify the project

```bash
cd SkillX/frontend
npm run build

cd ..
cargo test -p escrow-contract
cargo test -p job-manager-contract
cargo test -p milestone-manager-contract
cargo test -p reputation-contract
```

## API at a glance

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/profile` | Create or update a profile |
| `GET` | `/freelancers?category=react` | Browse freelancers by skill/category |
| `POST` | `/job` | Create job metadata and milestones |
| `GET` | `/jobs` | List marketplace jobs |
| `POST` | `/job/:jobId/accept` | Accept a job |
| `POST` | `/submit` | Submit milestone work |
| `POST` | `/milestone/:milestoneId/approve` | Approve milestone state |

## Deployed contracts

| Contract | Stellar Testnet contract |
| --- | --- |
| Escrow | [`CCPSEX…JKI4B`](https://stellar.expert/explorer/testnet/contract/CCPSEXCCYNIEYIDHZA774T6WQM3KXTLTETOI762G4USMTYFZXTVJKI4B) |
| Job Manager | [`CB7YQM…7IWC`](https://stellar.expert/explorer/testnet/contract/CB7YQMFJIKEEK3G4554JGDH3EIKJY3VN4ZT7CSDEKLH6WCECOV727IWC) |
| Milestone Manager | [`CDSVTV…ZMZ4`](https://stellar.expert/explorer/testnet/contract/CDSVTVOJET5YEVYXDOUHCQKA7C7PBSSYFMM3HS4NQVX3EAWCZIZWZMZ4) |
| Reputation | [`CAKQDK…ZSUN`](https://stellar.expert/explorer/testnet/contract/CAKQDKSSNVVBLBCHHL22Q3PDZ6VDGAUM2ERND4OKJ2VCL6JDDL4YZSUN) |

## Security notes

- Keep `.env` files, private keys, seed phrases, and Supabase service-role keys out of version control.
- The backend README documents the current wallet-identity boundary; add server-side signed-challenge verification before exposing mutations publicly.
- Use funded Stellar Testnet wallets for client and freelancer transaction flows.
