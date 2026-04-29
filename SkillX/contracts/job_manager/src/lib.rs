#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Vec,
};

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

/// Top-level job status stored on-chain.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum JobStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

/// Per-milestone lifecycle status.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Paid,
}

/// Minimal on-chain milestone record.
/// Full descriptions / names live off-chain in Supabase.
/// Only what the contract *needs* for trust and payment logic is stored here.
#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    /// keccak/sha256 of the off-chain milestone description (integrity anchor).
    pub hash: BytesN<32>,
    /// Percentage of total_amount allocated to this milestone (0–100).
    pub percentage: u32,
    /// Absolute token amount = total_amount * percentage / 100.
    pub amount: i128,
    /// Unix timestamp after which the milestone auto-approves.
    pub deadline: u64,
    /// Current lifecycle status.
    pub status: MilestoneStatus,
}

/// Core on-chain job record — lean by design.
#[contracttype]
#[derive(Clone)]
pub struct Job {
    /// sha256 of the off-chain job document stored in Supabase.
    pub job_hash: BytesN<32>,
    pub client: Address,
    /// None until a freelancer calls accept_job().
    pub freelancer: Option<Address>,
    /// Total locked amount in escrow (stroops for XLM).
    pub total_amount: i128,
    /// Ordered list of milestone definitions.
    pub milestones: Vec<Milestone>,
    pub status: JobStatus,
}

// ═══════════════════════════════════════════════════════════════
//  STORAGE KEYS
// ═══════════════════════════════════════════════════════════════

#[contracttype]
pub enum DataKey {
    /// job_id → Job
    Job(BytesN<32>),
    /// Singleton: address of the deployed EscrowContract.
    EscrowContract,
    /// Singleton: admin address allowed to configure the contract.
    Admin,
}

// ═══════════════════════════════════════════════════════════════
//  ESCROW CLIENT  (cross-contract interface)
// ═══════════════════════════════════════════════════════════════

/// Thin client for the EscrowContract.
/// Soroban cross-contract calls are just regular function invocations routed
/// through the host via `env.invoke_contract`.  We declare the interface with
/// `contractimport!` in a real project; here we call directly to stay
/// self-contained and explicit.
mod escrow_client {
    use soroban_sdk::{Address, BytesN, Env, Symbol, Val, Vec, IntoVal};

    /// Call `EscrowContract::release_payment(job_id, freelancer, amount)`.
    pub fn release_payment(
        env: &Env,
        escrow_id: &Address,
        job_id: &BytesN<32>,
        freelancer: &Address,
        amount: i128,
    ) {
        let args: Vec<Val> = (job_id.clone(), freelancer.clone(), amount).into_val(env);
        env.invoke_contract::<()>(escrow_id, &Symbol::new(env, "release_payment"), args);
    }

    /// Call `EscrowContract::refund(job_id, client)`.
    pub fn refund(
        env: &Env,
        escrow_id: &Address,
        job_id: &BytesN<32>,
        client: &Address,
    ) {
        let args: Vec<Val> = (job_id.clone(), client.clone()).into_val(env);
        env.invoke_contract::<()>(escrow_id, &Symbol::new(env, "refund"), args);
    }
}

// ═══════════════════════════════════════════════════════════════
//  CONTRACT
// ═══════════════════════════════════════════════════════════════

#[contract]
pub struct JobManagerContract;

#[contractimpl]
impl JobManagerContract {

    // ───────────────────────────────────────────────────────────
    //  INIT
    // ───────────────────────────────────────────────────────────

    /// One-time setup. Must be called immediately after deployment.
    ///
    /// * `admin`           – address that can update contract configuration.
    /// * `escrow_contract` – address of the already-deployed EscrowContract.
    pub fn initialize(env: Env, admin: Address, escrow_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &escrow_contract);
    }

    // ───────────────────────────────────────────────────────────
    //  CREATE JOB
    // ───────────────────────────────────────────────────────────

    /// Client creates a new job.
    ///
    /// Parameters
    /// ──────────
    /// * `job_id`        – caller-supplied unique ID (e.g. sha256 of job UUID).
    /// * `job_hash`      – sha256 of the full off-chain job document.
    /// * `client`        – client's wallet address (must sign).
    /// * `total_amount`  – total XLM in stroops to be locked in escrow.
    /// * `milestones`    – ordered milestone definitions.
    ///
    /// Rules enforced on-chain
    /// ───────────────────────
    /// • Sum of milestone percentages must equal 100.
    /// • Each milestone amount is derived from percentage, not caller-supplied
    ///   (prevents rounding attacks).
    /// • job_id must be unique.
    /// • At least one milestone required.
    pub fn create_job(
        env: Env,
        job_id: BytesN<32>,
        job_hash: BytesN<32>,
        client: Address,
        total_amount: i128,
        milestone_hashes: Vec<BytesN<32>>,
        milestone_percentages: Vec<u32>,
        milestone_deadlines: Vec<u64>,
    ) -> BytesN<32> {
        // 1. Auth
        client.require_auth();

        // 2. Uniqueness
        if env.storage().persistent().has(&DataKey::Job(job_id.clone())) {
            panic!("job_id already exists");
        }

        // 3. Input sanity
        let n = milestone_hashes.len();
        if n == 0 {
            panic!("at least one milestone required");
        }
        if milestone_percentages.len() != n || milestone_deadlines.len() != n {
            panic!("milestone arrays length mismatch");
        }
        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }

        // 4. Validate percentages sum to exactly 100
        let pct_sum: u32 = milestone_percentages.iter().sum();
        if pct_sum != 100 {
            panic!("milestone percentages must sum to 100");
        }

        // 5. Build Milestone structs with derived amounts
        let mut milestones: Vec<Milestone> = Vec::new(&env);
        for i in 0..n {
            let pct = milestone_percentages.get(i).unwrap();
            if pct == 0 {
                panic!("milestone percentage cannot be zero");
            }
            let amount = (total_amount * pct as i128) / 100;
            milestones.push_back(Milestone {
                hash: milestone_hashes.get(i).unwrap(),
                percentage: pct,
                amount,
                deadline: milestone_deadlines.get(i).unwrap(),
                status: MilestoneStatus::Pending,
            });
        }

        // 6. Persist
        let job = Job {
            job_hash,
            client,
            freelancer: None,
            total_amount,
            milestones,
            status: JobStatus::Open,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        job_id
    }

    // ───────────────────────────────────────────────────────────
    //  ACCEPT JOB
    // ───────────────────────────────────────────────────────────

    /// Freelancer claims an open job.
    ///
    /// Rules
    /// ─────
    /// • Job must be in Open status.
    /// • Freelancer cannot be the same address as the client.
    /// • Sets job status → InProgress and records freelancer address.
    pub fn accept_job(env: Env, job_id: BytesN<32>, freelancer: Address) {
        freelancer.require_auth();

        let mut job = Self::load_job(&env, &job_id);

        if job.status != JobStatus::Open {
            panic!("job is not open");
        }
        if job.client == freelancer {
            panic!("client cannot be freelancer");
        }

        job.freelancer = Some(freelancer);
        job.status = JobStatus::InProgress;

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id), &job);
    }

    // ───────────────────────────────────────────────────────────
    //  SUBMIT MILESTONE
    // ───────────────────────────────────────────────────────────

    /// Freelancer signals that milestone `milestone_index` is ready for review.
    ///
    /// Rules
    /// ─────
    /// • Only the registered freelancer may submit.
    /// • Job must be InProgress.
    /// • Milestone must be Pending.
    /// • Milestones must be submitted in order (index N requires index N-1 to
    ///   be Paid) — prevents submitting future milestones without finishing prior
    ///   ones.
    pub fn submit_milestone(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut job = Self::load_job(&env, &job_id);

        // Auth: only the accepted freelancer
        let freelancer = job.freelancer.clone().expect("no freelancer assigned");
        freelancer.require_auth();

        if job.status != JobStatus::InProgress {
            panic!("job not in progress");
        }

        let idx = milestone_index as usize;
        if idx >= job.milestones.len() as usize {
            panic!("milestone index out of bounds");
        }

        // Enforce sequential submission
        if idx > 0 {
            let prev = job.milestones.get((idx - 1) as u32).unwrap();
            if prev.status != MilestoneStatus::Paid {
                panic!("previous milestone not yet paid");
            }
        }

        let mut milestone = job.milestones.get(milestone_index).unwrap();
        if milestone.status != MilestoneStatus::Pending {
            panic!("milestone not in Pending status");
        }

        milestone.status = MilestoneStatus::Submitted;
        job.milestones.set(milestone_index, milestone);

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id), &job);
    }

    // ───────────────────────────────────────────────────────────
    //  APPROVE MILESTONE  (triggers cross-contract payment)
    // ───────────────────────────────────────────────────────────

    /// Client approves submitted milestone work and triggers escrow payment.
    ///
    /// Cross-contract call
    /// ───────────────────
    /// Calls `EscrowContract::release_payment(job_id, freelancer, amount)`.
    /// The escrow contract will verify that THIS contract is the registered
    /// job_manager (via `require_auth`), then transfer funds to the freelancer.
    ///
    /// Rules
    /// ─────
    /// • Only the client may approve.
    /// • Milestone must be in Submitted status.
    /// • Sets milestone → Approved, then immediately → Paid after escrow call.
    /// • If all milestones are Paid, job status → Completed.
    pub fn approve_milestone(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut job = Self::load_job(&env, &job_id);

        // Auth: only the client
        job.client.require_auth();

        if job.status != JobStatus::InProgress {
            panic!("job not in progress");
        }

        let idx = milestone_index;
        let mut milestone = job.milestones.get(idx).unwrap_or_else(|| {
            panic!("milestone index out of bounds")
        });

        if milestone.status != MilestoneStatus::Submitted {
            panic!("milestone not in Submitted status");
        }

        let freelancer = job.freelancer.clone().expect("no freelancer");

        // Mark Approved first (before external call — fail-fast pattern)
        milestone.status = MilestoneStatus::Approved;
        job.milestones.set(idx, milestone.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        // ── CROSS-CONTRACT CALL ──────────────────────────────────
        // Invoke EscrowContract::release_payment.
        // The escrow contract checks that env.current_contract_address()
        // (= this JobManager) is the registered job_manager and has authorised
        // this call.  We authorise on behalf of this contract automatically
        // because we ARE this contract executing right now.
        let escrow_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow not configured");

        escrow_client::release_payment(
            &env,
            &escrow_id,
            &job_id,
            &freelancer,
            milestone.amount,
        );
        // ────────────────────────────────────────────────────────

        // Mark Paid after successful escrow call
        let mut milestone_paid = job.milestones.get(idx).unwrap();
        milestone_paid.status = MilestoneStatus::Paid;
        job.milestones.set(idx, milestone_paid);

        // Check if all milestones are now Paid → complete the job
        let all_paid = job
            .milestones
            .iter()
            .all(|m| m.status == MilestoneStatus::Paid);
        if all_paid {
            job.status = JobStatus::Completed;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id), &job);
    }

    // ───────────────────────────────────────────────────────────
    //  CHECK TIMEOUT  (auto-approve after deadline)
    // ───────────────────────────────────────────────────────────

    /// Anyone may call this to trigger auto-approval if the milestone deadline
    /// has passed and the milestone is still Submitted.
    ///
    /// Design rationale
    /// ────────────────
    /// A client who goes silent should not trap a freelancer's funds forever.
    /// If `env.ledger().timestamp() > milestone.deadline` and the milestone is
    /// Submitted, we auto-approve and release payment — same path as manual
    /// approve, so no special escrow logic is needed.
    ///
    /// This function is intentionally callable by anyone (no auth) so that
    /// the freelancer, a keeper bot, or any third party can trigger it.
    pub fn check_timeout(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut job = Self::load_job(&env, &job_id);

        if job.status != JobStatus::InProgress {
            panic!("job not in progress");
        }

        let idx = milestone_index;
        let milestone = job.milestones.get(idx).unwrap_or_else(|| {
            panic!("milestone index out of bounds")
        });

        if milestone.status != MilestoneStatus::Submitted {
            panic!("milestone not in Submitted status");
        }

        let now = env.ledger().timestamp();
        if now <= milestone.deadline {
            panic!("deadline not yet reached");
        }

        let freelancer = job.freelancer.clone().expect("no freelancer");

        // Mark Approved
        let mut m = milestone.clone();
        m.status = MilestoneStatus::Approved;
        job.milestones.set(idx, m.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        // Cross-contract payment (same as approve_milestone)
        let escrow_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow not configured");

        escrow_client::release_payment(
            &env,
            &escrow_id,
            &job_id,
            &freelancer,
            m.amount,
        );

        // Mark Paid
        let mut m_paid = job.milestones.get(idx).unwrap();
        m_paid.status = MilestoneStatus::Paid;
        job.milestones.set(idx, m_paid);

        let all_paid = job
            .milestones
            .iter()
            .all(|ms| ms.status == MilestoneStatus::Paid);
        if all_paid {
            job.status = JobStatus::Completed;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id), &job);
    }

    // ───────────────────────────────────────────────────────────
    //  CANCEL JOB  (refund remaining escrow to client)
    // ───────────────────────────────────────────────────────────

    /// Client cancels an Open job (no freelancer yet) and receives a full
    /// refund from escrow.
    ///
    /// Rule: cannot cancel a job that is InProgress — this protects freelancers
    /// who have already accepted and may be working.
    pub fn cancel_job(env: Env, job_id: BytesN<32>) {
        let mut job = Self::load_job(&env, &job_id);
        job.client.require_auth();

        if job.status != JobStatus::Open {
            panic!("only Open jobs can be cancelled by client");
        }

        job.status = JobStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        // Refund escrow
        let escrow_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow not configured");

        escrow_client::refund(&env, &escrow_id, &job_id, &job.client);
    }

    // ───────────────────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ───────────────────────────────────────────────────────────

    /// Returns the full on-chain job record.
    pub fn get_job(env: Env, job_id: BytesN<32>) -> Job {
        Self::load_job(&env, &job_id)
    }

    /// Returns a single milestone by index.
    pub fn get_milestone(env: Env, job_id: BytesN<32>, index: u32) -> Milestone {
        let job = Self::load_job(&env, &job_id);
        job.milestones
            .get(index)
            .unwrap_or_else(|| panic!("milestone index out of bounds"))
    }

    /// Returns the current status of a job.
    pub fn get_job_status(env: Env, job_id: BytesN<32>) -> JobStatus {
        Self::load_job(&env, &job_id).status
    }

    // ───────────────────────────────────────────────────────────
    //  ADMIN
    // ───────────────────────────────────────────────────────────

    /// Update the EscrowContract address (admin only).
    pub fn update_escrow(env: Env, new_escrow: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &new_escrow);
    }

    // ───────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ───────────────────────────────────────────────────────────

    fn load_job(env: &Env, job_id: &BytesN<32>) -> Job {
        env.storage()
            .persistent()
            .get(&DataKey::Job(job_id.clone()))
            .unwrap_or_else(|| panic!("job not found"))
    }
}

// ═══════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address, BytesN, Env, Vec,
    };

    // ── helpers ──────────────────────────────────────────────────

    fn job_id(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[1u8; 32])
    }
    fn job_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[2u8; 32])
    }
    fn m_hash(env: &Env, n: u8) -> BytesN<32> {
        BytesN::from_array(env, &[n; 32])
    }

    /// Deploy manager + a mock escrow (we use a second manager instance as
    /// a stand-in; in integration tests you'd deploy the real escrow).
    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let mock_escrow = Address::generate(&env); // replaced by real escrow in integration
        let manager_id = env.register(JobManagerContract, ());
        let mgr = JobManagerContractClient::new(&env, &manager_id);
        mgr.initialize(&admin, &mock_escrow);

        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);

        (env, manager_id, mock_escrow, client, freelancer)
    }

    fn make_two_milestone_job(
        env: &Env,
        mgr: &JobManagerContractClient,
        client: &Address,
    ) {
        let hashes = Vec::from_array(env, [m_hash(env, 10), m_hash(env, 11)]);
        let pcts = Vec::from_array(env, [60u32, 40u32]);
        let deadlines = Vec::from_array(env, [9999u64, 99999u64]);
        mgr.create_job(
            &job_id(env),
            &job_hash(env),
            client,
            &1_000_0000000i128,
            &hashes,
            &pcts,
            &deadlines,
        );
    }

    // ── create_job ───────────────────────────────────────────────

    #[test]
    fn test_create_job_stores_correctly() {
        let (env, mgr_id, _, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);

        let job = mgr.get_job(&job_id(&env));
        assert_eq!(job.status, JobStatus::Open);
        assert_eq!(job.milestones.len(), 2);
        assert_eq!(job.milestones.get(0).unwrap().percentage, 60);
        assert_eq!(job.milestones.get(1).unwrap().percentage, 40);
        assert_eq!(job.milestones.get(0).unwrap().amount, 600_0000000i128);
        assert_eq!(job.milestones.get(1).unwrap().amount, 400_0000000i128);
    }

    #[test]
    #[should_panic(expected = "milestone percentages must sum to 100")]
    fn test_bad_percentages_rejected() {
        let (env, mgr_id, _, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        let hashes = Vec::from_array(&env, [m_hash(&env, 10), m_hash(&env, 11)]);
        let pcts = Vec::from_array(&env, [50u32, 40u32]); // sums to 90
        let deadlines = Vec::from_array(&env, [9999u64, 99999u64]);
        mgr.create_job(&job_id(&env), &job_hash(&env), &client,
            &1_000_0000000i128, &hashes, &pcts, &deadlines);
    }

    // ── accept_job ───────────────────────────────────────────────

    #[test]
    fn test_accept_job() {
        let (env, mgr_id, _, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);

        let job = mgr.get_job(&job_id(&env));
        assert_eq!(job.status, JobStatus::InProgress);
        assert_eq!(job.freelancer, Some(freelancer));
    }

    #[test]
    #[should_panic(expected = "client cannot be freelancer")]
    fn test_client_cannot_be_freelancer() {
        let (env, mgr_id, _, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &client);
    }

    // ── submit_milestone ─────────────────────────────────────────

    #[test]
    fn test_submit_milestone() {
        let (env, mgr_id, _, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);
        mgr.submit_milestone(&job_id(&env), &0u32);

        let m = mgr.get_milestone(&job_id(&env), &0u32);
        assert_eq!(m.status, MilestoneStatus::Submitted);
    }

    #[test]
    #[should_panic(expected = "previous milestone not yet paid")]
    fn test_sequential_submission_enforced() {
        let (env, mgr_id, _, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);
        // Skip to milestone 1 without paying milestone 0 first
        mgr.submit_milestone(&job_id(&env), &1u32);
    }

    // ── check_timeout ────────────────────────────────────────────
    // Note: approve_milestone and check_timeout call into EscrowContract
    // via cross-contract invocation.  In unit tests the mock_escrow address
    // is not a real contract, so those calls will panic unless you deploy
    // the real EscrowContract.  Use soroban-sdk integration test harness for
    // full end-to-end flow; here we test the timeout guard logic only.

    #[test]
    #[should_panic(expected = "deadline not yet reached")]
    fn test_timeout_not_triggered_early() {
        let (env, mgr_id, _, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);
        mgr.submit_milestone(&job_id(&env), &0u32);

        // Ledger timestamp is 0 by default — deadline is 9999, so not past
        mgr.check_timeout(&job_id(&env), &0u32);
    }

    #[test]
    #[should_panic(expected = "milestone not in Submitted status")]
    fn test_timeout_requires_submitted_status() {
        let (env, mgr_id, _, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        make_two_milestone_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);
        // Do NOT submit — milestone is still Pending

        env.ledger().set(LedgerInfo {
            timestamp: 99999,
            ..env.ledger().get()
        });
        mgr.check_timeout(&job_id(&env), &0u32);
    }
}