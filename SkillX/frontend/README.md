# SkillX Frontend

React frontend for the Stellar freelance marketplace with Freighter wallet login.

## Setup

1. Copy env file:
   - `cp .env.example .env`
2. Set values:
   - `VITE_API_BASE_URL=http://localhost:4000`
   - `VITE_SOROBAN_RPC_URL`
   - `VITE_NETWORK_PASSPHRASE`
   - `VITE_JOB_MANAGER_CONTRACT_ID`
   - `VITE_ESCROW_CONTRACT_ID`
3. Install and run:
   - `npm install`
   - `npm run dev`

## Pages

- Home
- Select Role (Client/Freelancer)
- Client Dashboard
  - Browse freelancers by category
  - Create job with milestones
- Freelancer Dashboard
  - View job request by id
  - Accept/reject and submit milestone
- Profile page
  - Portfolio and previous jobs

## Contract Call Samples

Implemented in `src/services/contracts.js`:
- `createJobOnChain(jobHash, milestoneHashes)`
- `acceptJobOnChain(jobId)`
- `submitMilestoneOnChain(jobId, milestoneIndex, submissionHash)`
- `depositEscrowOnChain(jobId, amount)`
