# SkillX - Decentralized Freelance Marketplace on Stellar

SkillX is a full-stack freelance marketplace where client-freelancer payments are handled by Soroban smart contracts on Stellar.

The platform uses milestone-based jobs with escrow, so payment logic is trustless and transparent.

## Stellar Journey Challenge Fit

This project targets the "Stellar Journey to Mastery: Monthly Builder Challenges" Builder Track by delivering a complete, deployable Stellar dApp with real smart contract usage, full-stack integration, and an MVP path from first transactions to real users.

## What This Project Includes

- `contracts/job_manager`: on-chain job lifecycle and milestone state transitions
- `contracts/escrow`: on-chain fund custody, release, and refund
- `backend`: Express + Supabase API for off-chain application data
- `frontend`: React + Freighter wallet UI (Fiverr-style flow)

## Architecture

### On-chain (Soroban contracts)

- `JobManagerContract`
  - Create/accept jobs
  - Submit/approve/timeout milestones
  - Calls `EscrowContract` to release payment or refund
- `EscrowContract`
  - Deposit job funds
  - Release milestone amount
  - Refund client when needed
  - Restricts payout/refund calls to the configured `JobManager`

### Off-chain (Backend + Supabase)

- User profiles
- Job descriptions
- Milestone metadata
- Submission file URLs

### Data boundary

On-chain:
- `job_hash`
- milestone hashes
- wallet addresses
- escrow balances and job state

Off-chain:
- full job text
- portfolio/profile content
- files and UI metadata

## Repository Structure

```text
SkillX/
├── backend/
│   ├── src/
│   ├── supabase-schema.sql
│   └── README.md
├── contracts/
│   ├── escrow/
│   └── job_manager/
├── frontend/
│   ├── src/
│   └── README.md
├── Cargo.toml
└── README.md
```

## End-to-End Workflow

1. Client connects wallet and creates profile.
2. Client creates job + milestones (stored in Supabase via backend).
3. Backend generates job/milestone hashes.
4. Frontend calls `JobManager.create_job(...)` on-chain.
5. Client deposits to `Escrow.deposit(...)`.
6. Freelancer accepts job on-chain and submits milestone.
7. Client approves milestone (or timeout auto-approves).
8. `JobManager` calls `Escrow.release_payment(...)`.
9. Funds are transferred trustlessly to freelancer.

## Smart Contract Interaction

Contracts are linked both ways:

- `JobManager.initialize(admin, escrow_contract_address)`
- `Escrow.initialize(job_manager_address, token_id)`

Cross-contract calls:

- `JobManager -> Escrow.release_payment(job_id, freelancer, amount)`
- `JobManager -> Escrow.refund(job_id, client)`

## Local Setup

## 1) Backend setup

```bash
cp backend/.env.example backend/.env
npm install --prefix backend
npm run dev --prefix backend
```

Required backend env:
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Apply schema in Supabase SQL editor:
- `backend/supabase-schema.sql`

## 2) Frontend setup

```bash
cp frontend/.env.example frontend/.env
npm install --prefix frontend
npm run dev --prefix frontend
```

Required frontend env:
- `VITE_API_BASE_URL`
- `VITE_SOROBAN_RPC_URL`
- `VITE_NETWORK_PASSPHRASE`
- `VITE_JOB_MANAGER_CONTRACT_ID`
- `VITE_ESCROW_CONTRACT_ID`

## 3) Contracts

Build/test contracts from `SkillX` root:

```bash
cargo test -p escrow
cargo test -p job_manager
```

Deploy both contracts and initialize each with the other's deployed address.

## API Summary (Backend)

- `POST /profile`
- `GET /freelancers?category=`
- `POST /job`
- `GET /job/:jobId`
- `POST /submit`
- `GET /health`

## Frontend Pages

- Home
- Role selection
- Client dashboard
- Freelancer dashboard
- Profile page

Includes dark mode and Freighter wallet connect.

## Verification Checklist

- Backend `GET /health` returns `{ "ok": true }`
- Supabase rows created for profile/job/milestones/submissions
- Freighter prompts for contract transactions
- On-chain tx succeeds for:
  - create job
  - accept job
  - submit milestone
  - escrow deposit/release path

## Notes

- Backend handles off-chain app logic only.
- Trust-critical payment flow is enforced on-chain.
- Keep `.env` files private; `.env.example` is safe to commit.
