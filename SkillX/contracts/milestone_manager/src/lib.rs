#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Symbol, Vec,
};

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

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
#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    /// sha256 of the off-chain milestone description (integrity anchor).
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

/// Stored record for milestones associated with a job.
#[contracttype]
#[derive(Clone)]
pub struct JobMilestones {
    /// The client who created the job (can approve milestones).
    pub client: Address,
    /// The freelancer who accepted the job (can submit milestones).
    pub freelancer: Address,
    /// Total escrowed amount.
    pub total_amount: i128,
    /// Ordered list of milestones.
    pub milestones: Vec<Milestone>,
}

// ═══════════════════════════════════════════════════════════════
//  EVENT TYPES
// ═══════════════════════════════════════════════════════════════

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MilestoneCreatedEvent {
    pub job_id: BytesN<32>,
    pub client: Address,
    pub freelancer: Address,
    pub milestone_count: u32,
    pub total_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MilestoneSubmittedEvent {
    pub job_id: BytesN<32>,
    pub milestone_index: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MilestoneApprovedEvent {
    pub job_id: BytesN<32>,
    pub milestone_index: u32,
    pub amount: i128,
}

// ═══════════════════════════════════════════════════════════════
//  STORAGE KEYS
// ═══════════════════════════════════════════════════════════════

#[contracttype]
pub enum DataKey {
    /// job_id → JobMilestones
    Milestones(BytesN<32>),
    /// Singleton: address of the deployed EscrowContract.
    EscrowContract,
    /// Singleton: address of the deployed JobManagerContract.
    JobManager,
    /// Singleton: admin address.
    Admin,
}

// ═══════════════════════════════════════════════════════════════
//  ESCROW CLIENT (cross-contract interface)
// ═══════════════════════════════════════════════════════════════

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
}

// ═══════════════════════════════════════════════════════════════
//  CONTRACT
// ═══════════════════════════════════════════════════════════════

#[contract]
pub struct MilestoneManagerContract;

#[contractimpl]
impl MilestoneManagerContract {

    // ───────────────────────────────────────────────────────────
    //  INIT
    // ───────────────────────────────────────────────────────────

    /// One-time setup. Must be called immediately after deployment.
    pub fn initialize(
        env: Env,
        admin: Address,
        escrow_contract: Address,
        job_manager: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &escrow_contract);
        env.storage()
            .instance()
            .set(&DataKey::JobManager, &job_manager);
    }

    // ───────────────────────────────────────────────────────────
    //  ADD MILESTONES
    // ───────────────────────────────────────────────────────────

    /// Register milestones for a job.
    ///
    /// Rules enforced on-chain:
    /// • Sum of percentages must equal 100.
    /// • Each percentage must be > 0.
    /// • At least one milestone required.
    /// • Arrays must have matching lengths.
    /// • job_id must not already have milestones registered.
    pub fn add_milestones(
        env: Env,
        job_id: BytesN<32>,
        client: Address,
        freelancer: Address,
        total_amount: i128,
        milestone_hashes: Vec<BytesN<32>>,
        milestone_percentages: Vec<u32>,
        milestone_deadlines: Vec<u64>,
    ) {
        client.require_auth();

        if env.storage().persistent().has(&DataKey::Milestones(job_id.clone())) {
            panic!("milestones already registered for this job");
        }

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

        let pct_sum: u32 = milestone_percentages.iter().sum();
        if pct_sum != 100 {
            panic!("milestone percentages must sum to 100");
        }

        let mut milestones: Vec<Milestone> = Vec::new(&env);
        for i in 0..n {
            let pct = milestone_percentages.get(i).unwrap();
            if pct == 0 {
                panic!("milestone percentage cannot be zero");
            }
            milestones.push_back(Milestone {
                hash: milestone_hashes.get(i).unwrap(),
                percentage: pct,
                amount: (total_amount * pct as i128) / 100,
                deadline: milestone_deadlines.get(i).unwrap(),
                status: MilestoneStatus::Pending,
            });
        }

        let job_milestones = JobMilestones {
            client: client.clone(),
            freelancer: freelancer.clone(),
            total_amount,
            milestones,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Milestones(job_id.clone()), &job_milestones);

        env.events().publish(
            (Symbol::new(&env, "MilestoneCreated"), job_id.clone()),
            &MilestoneCreatedEvent {
                job_id,
                client,
                freelancer,
                milestone_count: n as u32,
                total_amount,
            },
        );
    }

    // ───────────────────────────────────────────────────────────
    //  SUBMIT MILESTONE
    // ───────────────────────────────────────────────────────────

    /// Freelancer signals that milestone `milestone_index` is ready for review.
    ///
    /// Rules:
    /// • Only the registered freelancer may submit.
    /// • Milestone must be Pending.
    /// • Milestones must be submitted in order.
    pub fn submit_milestone(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut jm = Self::load_milestones(&env, &job_id);
        jm.freelancer.require_auth();

        let idx = milestone_index as usize;
        if idx >= jm.milestones.len() as usize {
            panic!("milestone index out of bounds");
        }

        // Enforce sequential submission
        if idx > 0 {
            let prev = jm.milestones.get((idx - 1) as u32).unwrap();
            if prev.status != MilestoneStatus::Paid {
                panic!("previous milestone not yet paid");
            }
        }

        let mut milestone = jm.milestones.get(milestone_index).unwrap();
        if milestone.status != MilestoneStatus::Pending {
            panic!("milestone not in Pending status");
        }

        milestone.status = MilestoneStatus::Submitted;
        jm.milestones.set(milestone_index, milestone);

        env.storage()
            .persistent()
            .set(&DataKey::Milestones(job_id.clone()), &jm);

        env.events().publish(
            (Symbol::new(&env, "MilestoneSubmitted"), job_id.clone()),
            &MilestoneSubmittedEvent {
                job_id,
                milestone_index,
            },
        );
    }

    // ───────────────────────────────────────────────────────────
    //  APPROVE MILESTONE (triggers cross-contract payment)
    // ───────────────────────────────────────────────────────────

    /// Client approves submitted milestone work and triggers escrow payment.
    ///
    /// Cross-contract: calls `EscrowContract::release_payment(job_id, freelancer, amount)`.
    ///
    /// Rules:
    /// • Only the client may approve.
    /// • Milestone must be in Submitted status.
    pub fn approve_milestone(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut jm = Self::load_milestones(&env, &job_id);
        jm.client.require_auth();

        let milestone = jm.milestones.get(milestone_index).unwrap_or_else(|| {
            panic!("milestone index out of bounds")
        });

        if milestone.status != MilestoneStatus::Submitted {
            panic!("milestone not in Submitted status");
        }

        let payout_amount = milestone.amount;
        let freelancer = jm.freelancer.clone();

        // Cross-contract: release payment from escrow
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
            payout_amount,
        );

        // Mark milestone as Paid (single write after successful escrow call)
        let mut milestone_final = jm.milestones.get(milestone_index).unwrap();
        milestone_final.status = MilestoneStatus::Paid;
        jm.milestones.set(milestone_index, milestone_final);

        env.storage()
            .persistent()
            .set(&DataKey::Milestones(job_id.clone()), &jm);

        env.events().publish(
            (Symbol::new(&env, "MilestoneApproved"), job_id.clone()),
            &MilestoneApprovedEvent {
                job_id,
                milestone_index,
                amount: payout_amount,
            },
        );
    }

    // ───────────────────────────────────────────────────────────
    //  CHECK TIMEOUT (auto-approve after deadline)
    // ───────────────────────────────────────────────────────────

    /// Anyone may call this to trigger auto-approval if the milestone deadline
    /// has passed and the milestone is still Submitted.
    pub fn check_timeout(env: Env, job_id: BytesN<32>, milestone_index: u32) {
        let mut jm = Self::load_milestones(&env, &job_id);

        let milestone = jm.milestones.get(milestone_index).unwrap_or_else(|| {
            panic!("milestone index out of bounds")
        });

        if milestone.status != MilestoneStatus::Submitted {
            panic!("milestone not in Submitted status");
        }

        if env.ledger().timestamp() <= milestone.deadline {
            panic!("deadline not yet reached");
        }

        let payout_amount = milestone.amount;
        let freelancer = jm.freelancer.clone();

        // Cross-contract: release payment from escrow
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
            payout_amount,
        );

        // Mark milestone as Paid (single write)
        let mut milestone_final = jm.milestones.get(milestone_index).unwrap();
        milestone_final.status = MilestoneStatus::Paid;
        jm.milestones.set(milestone_index, milestone_final);

        env.storage()
            .persistent()
            .set(&DataKey::Milestones(job_id), &jm);
    }

    /// Update the freelancer address (called only by JobManagerContract on accept_job).
    pub fn bind_freelancer(env: Env, job_id: BytesN<32>, freelancer: Address) {
        Self::require_job_manager(&env);
        if env.storage().persistent().has(&DataKey::Milestones(job_id.clone())) {
            let mut jm = Self::load_milestones(&env, &job_id);
            jm.freelancer = freelancer;
            env.storage()
                .persistent()
                .set(&DataKey::Milestones(job_id), &jm);
        }
    }

    // ───────────────────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ───────────────────────────────────────────────────────────

    /// Returns a single milestone by index.
    pub fn get_milestone(env: Env, job_id: BytesN<32>, index: u32) -> Milestone {
        let jm = Self::load_milestones(&env, &job_id);
        jm.milestones
            .get(index)
            .unwrap_or_else(|| panic!("milestone index out of bounds"))
    }

    /// Returns all milestones for a job.
    pub fn get_milestones(env: Env, job_id: BytesN<32>) -> JobMilestones {
        Self::load_milestones(&env, &job_id)
    }

    /// Returns true if all milestones for a job are Paid.
    pub fn all_milestones_paid(env: Env, job_id: BytesN<32>) -> bool {
        let jm = Self::load_milestones(&env, &job_id);
        jm.milestones.iter().all(|m| m.status == MilestoneStatus::Paid)
    }

    // ───────────────────────────────────────────────────────────
    //  ADMIN
    // ───────────────────────────────────────────────────────────

    /// Update the EscrowContract address (admin only).
    pub fn update_escrow(env: Env, new_escrow: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &new_escrow);
    }

    /// Update the JobManager address (admin only).
    pub fn update_job_manager(env: Env, new_job_manager: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::JobManager, &new_job_manager);
    }

    // ───────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ───────────────────────────────────────────────────────────

    fn load_milestones(env: &Env, job_id: &BytesN<32>) -> JobMilestones {
        env.storage()
            .persistent()
            .get(&DataKey::Milestones(job_id.clone()))
            .unwrap_or_else(|| panic!("milestones not found for this job"))
    }

    fn require_job_manager(env: &Env) {
        let jm: Address = env
            .storage()
            .instance()
            .get(&DataKey::JobManager)
            .expect("job manager not configured");
        jm.require_auth();
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialised");
        admin.require_auth();
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
    fn m_hash(env: &Env, n: u8) -> BytesN<32> {
        BytesN::from_array(env, &[n; 32])
    }

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let mock_escrow = Address::generate(&env);
        let mock_job_mgr = Address::generate(&env);
        let mm_id = env.register(MilestoneManagerContract, ());
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        mm.initialize(&admin, &mock_escrow, &mock_job_mgr);

        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);

        (env, mm_id, mock_escrow, client, freelancer)
    }

    fn add_two_milestones(
        env: &Env,
        mm: &MilestoneManagerContractClient,
        client: &Address,
        freelancer: &Address,
    ) {
        let hashes = Vec::from_array(env, [m_hash(env, 10), m_hash(env, 11)]);
        let pcts = Vec::from_array(env, [60u32, 40u32]);
        let deadlines = Vec::from_array(env, [9999u64, 99999u64]);
        mm.add_milestones(
            &job_id(env),
            client,
            freelancer,
            &1_000_0000000i128,
            &hashes,
            &pcts,
            &deadlines,
        );
    }

    // ── add_milestones ──────────────────────────────────────────

    #[test]
    fn test_add_milestones_stores_correctly() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);

        let jm = mm.get_milestones(&job_id(&env));
        assert_eq!(jm.milestones.len(), 2);
        assert_eq!(jm.milestones.get(0).unwrap().percentage, 60);
        assert_eq!(jm.milestones.get(1).unwrap().percentage, 40);
        assert_eq!(jm.milestones.get(0).unwrap().amount, 600_0000000i128);
        assert_eq!(jm.milestones.get(1).unwrap().amount, 400_0000000i128);
        assert_eq!(jm.client, client);
        assert_eq!(jm.freelancer, freelancer);
    }

    #[test]
    #[should_panic(expected = "milestone percentages must sum to 100")]
    fn test_bad_percentages_rejected() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        let hashes = Vec::from_array(&env, [m_hash(&env, 10), m_hash(&env, 11)]);
        let pcts = Vec::from_array(&env, [50u32, 40u32]); // sums to 90
        let deadlines = Vec::from_array(&env, [9999u64, 99999u64]);
        mm.add_milestones(
            &job_id(&env), &client, &freelancer,
            &1_000_0000000i128, &hashes, &pcts, &deadlines,
        );
    }

    #[test]
    #[should_panic(expected = "milestones already registered for this job")]
    fn test_double_registration_rejected() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        add_two_milestones(&env, &mm, &client, &freelancer);
    }

    // ── submit_milestone ────────────────────────────────────────

    #[test]
    fn test_submit_milestone() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        mm.submit_milestone(&job_id(&env), &0u32);

        let m = mm.get_milestone(&job_id(&env), &0u32);
        assert_eq!(m.status, MilestoneStatus::Submitted);
    }

    #[test]
    #[should_panic(expected = "previous milestone not yet paid")]
    fn test_sequential_submission_enforced() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        // Skip to milestone 1 without paying milestone 0 first
        mm.submit_milestone(&job_id(&env), &1u32);
    }

    // ── check_timeout guards ────────────────────────────────────

    #[test]
    #[should_panic(expected = "deadline not yet reached")]
    fn test_timeout_not_triggered_early() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        mm.submit_milestone(&job_id(&env), &0u32);

        // Ledger timestamp is 0 by default — deadline is 9999
        mm.check_timeout(&job_id(&env), &0u32);
    }

    #[test]
    #[should_panic(expected = "milestone not in Submitted status")]
    fn test_timeout_requires_submitted_status() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        // Do NOT submit — milestone is still Pending

        env.ledger().set(LedgerInfo {
            timestamp: 99999,
            ..env.ledger().get()
        });
        mm.check_timeout(&job_id(&env), &0u32);
    }

    // ── all_milestones_paid ─────────────────────────────────────

    #[test]
    fn test_all_milestones_paid_false_initially() {
        let (env, mm_id, _, client, freelancer) = setup();
        let mm = MilestoneManagerContractClient::new(&env, &mm_id);
        add_two_milestones(&env, &mm, &client, &freelancer);
        assert!(!mm.all_milestones_paid(&job_id(&env)));
    }
}
