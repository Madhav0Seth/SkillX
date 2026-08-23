#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Symbol,
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

/// Core on-chain job record — lean by design.
/// Milestones are managed by MilestoneManagerContract.
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
    pub status: JobStatus,
}

// ═══════════════════════════════════════════════════════════════
//  EVENT TYPES
// ═══════════════════════════════════════════════════════════════

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct JobCreatedEvent {
    pub job_id: BytesN<32>,
    pub client: Address,
    pub total_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct JobAcceptedEvent {
    pub job_id: BytesN<32>,
    pub freelancer: Address,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct JobCancelledEvent {
    pub job_id: BytesN<32>,
    pub client: Address,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct JobCompletedEvent {
    pub job_id: BytesN<32>,
    pub client: Address,
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
    /// Singleton: address of the deployed MilestoneManagerContract.
    MilestoneManager,
    /// Singleton: admin address allowed to configure the contract.
    Admin,
}

// ═══════════════════════════════════════════════════════════════
//  CROSS-CONTRACT CLIENTS
// ═══════════════════════════════════════════════════════════════

mod escrow_client {
    use soroban_sdk::{Address, BytesN, Env, Symbol, Val, Vec, IntoVal};

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

mod milestone_client {
    use soroban_sdk::{Address, BytesN, Env, Symbol, Val, Vec, IntoVal};

    /// Call `MilestoneManagerContract::all_milestones_paid(job_id) -> bool`.
    pub fn all_milestones_paid(
        env: &Env,
        mm_id: &Address,
        job_id: &BytesN<32>,
    ) -> bool {
        let args: Vec<Val> = (job_id.clone(),).into_val(env);
        env.invoke_contract::<bool>(mm_id, &Symbol::new(env, "all_milestones_paid"), args)
    }

    /// Call `MilestoneManagerContract::bind_freelancer(job_id, freelancer)`.
    pub fn bind_freelancer(
        env: &Env,
        mm_id: &Address,
        job_id: &BytesN<32>,
        freelancer: &Address,
    ) {
        let args: Vec<Val> = (job_id.clone(), freelancer.clone()).into_val(env);
        env.invoke_contract::<()>(mm_id, &Symbol::new(env, "bind_freelancer"), args);
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
    pub fn initialize(
        env: Env,
        admin: Address,
        escrow_contract: Address,
        milestone_manager: Address,
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
            .set(&DataKey::MilestoneManager, &milestone_manager);
    }

    // ───────────────────────────────────────────────────────────
    //  CREATE JOB
    // ───────────────────────────────────────────────────────────

    /// Client creates a new job.
    ///
    /// Milestones are registered separately via MilestoneManagerContract.
    pub fn create_job(
        env: Env,
        job_id: BytesN<32>,
        job_hash: BytesN<32>,
        client: Address,
        total_amount: i128,
    ) -> BytesN<32> {
        client.require_auth();

        if env.storage().persistent().has(&DataKey::Job(job_id.clone())) {
            panic!("job_id already exists");
        }
        if total_amount <= 0 {
            panic!("total_amount must be positive");
        }

        let job = Job {
            job_hash,
            client: client.clone(),
            freelancer: None,
            total_amount,
            status: JobStatus::Open,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events().publish(
            (Symbol::new(&env, "JobCreated"), job_id.clone()),
            &JobCreatedEvent {
                job_id: job_id.clone(),
                client,
                total_amount,
            },
        );

        job_id
    }

    // ───────────────────────────────────────────────────────────
    //  ACCEPT JOB
    // ───────────────────────────────────────────────────────────

    /// Freelancer claims an open job.
    ///
    /// Rules:
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

        job.freelancer = Some(freelancer.clone());
        job.status = JobStatus::InProgress;

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events().publish(
            (Symbol::new(&env, "JobAccepted"), job_id.clone()),
            &JobAcceptedEvent {
                job_id: job_id.clone(),
                freelancer: freelancer.clone(),
            },
        );

        // Cross-contract: update the freelancer address on MilestoneManager
        let mm_id = Self::load_milestone_manager(&env);
        milestone_client::bind_freelancer(&env, &mm_id, &job_id, &freelancer);
    }

    // ───────────────────────────────────────────────────────────
    //  COMPLETE JOB
    // ───────────────────────────────────────────────────────────

    /// Mark a job as completed. Can be called by the client.
    /// Verifies all milestones are paid via cross-contract call.
    pub fn complete_job(env: Env, job_id: BytesN<32>) {
        let mut job = Self::load_job(&env, &job_id);
        job.client.require_auth();

        if job.status != JobStatus::InProgress {
            panic!("job not in progress");
        }

        let mm_id = Self::load_milestone_manager(&env);
        if !milestone_client::all_milestones_paid(&env, &mm_id, &job_id) {
            panic!("not all milestones are paid yet");
        }

        job.status = JobStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events().publish(
            (Symbol::new(&env, "JobCompleted"), job_id.clone()),
            &JobCompletedEvent {
                job_id,
                client: job.client,
            },
        );
    }

    // ───────────────────────────────────────────────────────────
    //  CANCEL JOB (refund remaining escrow to client)
    // ───────────────────────────────────────────────────────────

    /// Client cancels an Open job and receives a full refund from escrow.
    ///
    /// Rule: cannot cancel a job that is InProgress.
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

        env.events().publish(
            (Symbol::new(&env, "JobCancelled"), job_id.clone()),
            &JobCancelledEvent {
                job_id: job_id.clone(),
                client: job.client.clone(),
            },
        );

        // Refund escrow
        let escrow_id = Self::load_escrow(&env);
        escrow_client::refund(&env, &escrow_id, &job_id, &job.client);
    }

    // ───────────────────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ───────────────────────────────────────────────────────────

    /// Returns the full on-chain job record.
    pub fn get_job(env: Env, job_id: BytesN<32>) -> Job {
        Self::load_job(&env, &job_id)
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
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::EscrowContract, &new_escrow);
    }

    /// Update the MilestoneManager address (admin only).
    pub fn update_milestone_manager(env: Env, new_mm: Address) {
        Self::require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::MilestoneManager, &new_mm);
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

    fn load_escrow(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::EscrowContract)
            .expect("escrow not configured")
    }

    fn load_milestone_manager(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::MilestoneManager)
            .expect("milestone manager not configured")
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
        contract, contractimpl,
        testutils::Address as _,
        Address, BytesN, Env,
    };

    #[contract]
    pub struct MockMilestoneManager;

    #[contractimpl]
    impl MockMilestoneManager {
        pub fn bind_freelancer(_env: Env, _job_id: BytesN<32>, _freelancer: Address) {}
    }

    // ── helpers ──────────────────────────────────────────────────

    fn job_id(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[1u8; 32])
    }
    fn job_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[2u8; 32])
    }

    fn setup() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let mock_escrow = Address::generate(&env);
        let mock_mm = env.register(MockMilestoneManager, ());
        let manager_id = env.register(JobManagerContract, ());
        let mgr = JobManagerContractClient::new(&env, &manager_id);
        mgr.initialize(&admin, &mock_escrow, &mock_mm);

        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);

        (env, manager_id, client, freelancer)
    }

    fn create_basic_job(
        env: &Env,
        mgr: &JobManagerContractClient,
        client: &Address,
    ) {
        mgr.create_job(
            &job_id(env),
            &job_hash(env),
            client,
            &1_000_0000000i128,
        );
    }

    // ── create_job ───────────────────────────────────────────────

    #[test]
    fn test_create_job_stores_correctly() {
        let (env, mgr_id, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);

        let job = mgr.get_job(&job_id(&env));
        assert_eq!(job.status, JobStatus::Open);
        assert_eq!(job.total_amount, 1_000_0000000i128);
        assert_eq!(job.client, client);
        assert_eq!(job.freelancer, None);
    }

    #[test]
    #[should_panic(expected = "job_id already exists")]
    fn test_duplicate_job_rejected() {
        let (env, mgr_id, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);
        create_basic_job(&env, &mgr, &client);
    }

    // ── accept_job ───────────────────────────────────────────────

    #[test]
    fn test_accept_job() {
        let (env, mgr_id, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);

        let job = mgr.get_job(&job_id(&env));
        assert_eq!(job.status, JobStatus::InProgress);
        assert_eq!(job.freelancer, Some(freelancer));
    }

    #[test]
    #[should_panic(expected = "client cannot be freelancer")]
    fn test_client_cannot_be_freelancer() {
        let (env, mgr_id, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &client);
    }

    #[test]
    #[should_panic(expected = "job is not open")]
    fn test_accept_non_open_job_panics() {
        let (env, mgr_id, client, freelancer) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);
        mgr.accept_job(&job_id(&env), &freelancer);
        // Try to accept again
        let freelancer2 = Address::generate(&env);
        mgr.accept_job(&job_id(&env), &freelancer2);
    }

    // ── get_job_status ──────────────────────────────────────────

    #[test]
    fn test_get_job_status() {
        let (env, mgr_id, client, _) = setup();
        let mgr = JobManagerContractClient::new(&env, &mgr_id);
        create_basic_job(&env, &mgr, &client);
        assert_eq!(mgr.get_job_status(&job_id(&env)), JobStatus::Open);
    }
}