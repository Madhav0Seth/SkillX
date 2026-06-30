# SkillX Backend

Express + Supabase backend for the decentralized freelance marketplace.

## Setup

1. Copy env:
   - `cp .env.example .env`
2. Fill values in `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Install deps:
   - `npm install`
4. Start server:
   - `npm run dev`

## Database

Run `supabase-schema.sql` in Supabase SQL editor.

## Soroban events

The Soroban contracts now emit compact lifecycle events for important state transitions. These are intended for off-chain listeners, indexers, and the frontend to react to real-time updates without storing extra state on-chain.

### Event sources
- JobManager contract: emits job lifecycle events for job creation, acceptance, cancellation, and completion.
- MilestoneManager contract: emits milestone lifecycle events for milestone creation, submission, and approval.
- Escrow contract: emits funding, payment release, and refund events.
- Reputation contract: emits reputation and rating updates after verified job completion and review submission.

### Current event names
- JobCreated
- JobAccepted
- JobCancelled
- JobCompleted
- MilestoneCreated
- MilestoneSubmitted
- MilestoneApproved
- EscrowFunded
- PaymentReleased
- RefundIssued
- ReputationUpdated
- RatingSubmitted

### Event payloads
Each event carries only the minimal meaningful data needed by an external consumer:
- job ID, addresses, amounts, milestone index, and rating where relevant.

### Frontend integration guidance
These events are suitable for:
- updating the UI after a job or milestone changes state
- refreshing dashboard lists in real time
- notifying the user when escrow funds or payments move
- keeping reputation badges and stats in sync

These events are intentionally compact and do not duplicate full business data that already lives in the database or off-chain application state.

### `POST /profile`

Create or update user profile.

```json
{
  "wallet_address": "GB....",
  "role": "freelancer",
  "skills": ["solidity", "react"],
  "bio": "Soroban dev",
  "portfolio": "https://portfolio.example"
}
```
### `GET /freelancers?category=react`

List freelancer profiles. `category` is optional and filters by `skills`.

### `POST /job`

Create a job and optional milestones. `job_hash` is generated automatically.

```json
{
  "client_wallet": "GC....",
  "freelancer_wallet": "GF....",
  "title": "Build Soroban escrow UI",
  "description": "Need milestone-based frontend and API integration.",
  "milestones": [
    {
      "name": "UI screens",
      "percentage": 40,
      "amount": 400,
      "deadline": "2026-05-12T00:00:00Z"
    },
    {
      "name": "Wallet + contract integration",
      "percentage": 60,
      "amount": 600,
      "deadline": "2026-05-20T00:00:00Z"
    }
  ]
}
```

### `GET /job/:jobId`

Fetch a job with its milestones.

### `POST /submit`

Create a milestone submission. `submission_hash` is generated automatically.

```json
{
  "milestone_id": 1,
  "file_url": "https://storage.example/submissions/demo.zip"
}
```
