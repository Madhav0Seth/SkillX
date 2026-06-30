//! Integration test: full end-to-end flow with ALL THREE contracts deployed.
//!
//! Run with:
//!   cargo test --test integration -- --nocapture
//!
//! This test deploys Escrow, JobManager, and MilestoneManager into the same
//! Soroban test environment, wires them together via initialize(), then
//! exercises the full lifecycle:
//!   deposit → create_job → accept_job → add_milestones → submit → approve (cross-call)
//!
//! It also tests the timeout path and cancel/refund path.

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, Vec,
};

// Import the three contracts.
use escrow_contract::{EscrowContract, EscrowContractClient};
use job_manager_contract::{JobManagerContract, JobManagerContractClient};
use milestone_manager_contract::{MilestoneManagerContract, MilestoneManagerContractClient};

// ── helpers ──────────────────────────────────────────────────────────────────

fn b32(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

struct Ctx {
    env: Env,
    mgr: JobManagerContractClient<'static>,
    mm: MilestoneManagerContractClient<'static>,
    escrow: EscrowContractClient<'static>,
    token: TokenClient<'static>,
    client_addr: Address,
    freelancer: Address,
}

fn setup_full() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();

    // ── Deploy XLM SAC ────────────────────────────────────────────────────
    let token_admin = Address::generate(&env);
    let token_id = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    // ── Deploy Escrow ─────────────────────────────────────────────────────
    let escrow_id = env.register(EscrowContract, ());
    let escrow_client = EscrowContractClient::new(&env, &escrow_id);

    // ── Deploy JobManager ─────────────────────────────────────────────────
    let mgr_id = env.register(JobManagerContract, ());
    let mgr = JobManagerContractClient::new(&env, &mgr_id);

    // ── Deploy MilestoneManager ───────────────────────────────────────────
    let mm_id = env.register(MilestoneManagerContract, ());
    let mm = MilestoneManagerContractClient::new(&env, &mm_id);

    let admin = Address::generate(&env);

    // Wire them together:
    // - Escrow: job_manager for refunds, milestone_manager for payments
    // - JobManager: escrow for refunds, milestone_manager for completion check
    // - MilestoneManager: escrow for payments, job_manager for validation
    escrow_client.initialize(&mgr_id, &mm_id, &token_id);
    mgr.initialize(&admin, &escrow_id, &mm_id);
    mm.initialize(&admin, &escrow_id, &mgr_id);

    // ── Mint tokens to client ─────────────────────────────────────────────
    let client_addr = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let sac = StellarAssetClient::new(&env, &token_id);
    sac.mint(&client_addr, &1_000_0000000i128);

    let token = TokenClient::new(&env, &token_id);

    Ctx {
        env,
        mgr,
        mm,
        escrow: escrow_client,
        token,
        client_addr,
        freelancer,
    }
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[test]
fn test_full_two_milestone_lifecycle() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let mm = &ctx.mm;
    let jid = b32(env, 1);

    // 1. Client deposits into escrow
    ctx.escrow.deposit(&jid, &ctx.client_addr, &1_000_0000000i128);

    // 2. Create job on JobManager (no milestones here)
    mgr.create_job(
        &jid,
        &b32(env, 99),
        &ctx.client_addr,
        &1_000_0000000i128,
    );

    // 3. Freelancer accepts
    mgr.accept_job(&jid, &ctx.freelancer);

    // 4. Register milestones on MilestoneManager
    let hashes = Vec::from_array(env, [b32(env, 10), b32(env, 11)]);
    let pcts = Vec::from_array(env, [60u32, 40u32]);
    let deadlines = Vec::from_array(env, [9_999u64, 99_999u64]);
    mm.add_milestones(
        &jid,
        &ctx.client_addr,
        &ctx.freelancer,
        &1_000_0000000i128,
        &hashes,
        &pcts,
        &deadlines,
    );

    // 5. Freelancer submits milestone 0
    mm.submit_milestone(&jid, &0u32);

    // 6. Client approves → cross-contract call → escrow releases 600 XLM
    mm.approve_milestone(&jid, &0u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 600_0000000i128);

    // 7. Freelancer submits milestone 1
    mm.submit_milestone(&jid, &1u32);

    // 8. Client approves final milestone
    mm.approve_milestone(&jid, &1u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 1_000_0000000i128);

    // 9. Verify all milestones are paid
    assert!(mm.all_milestones_paid(&jid));

    // 10. Client completes the job
    mgr.complete_job(&jid);
    let job = mgr.get_job(&jid);
    assert_eq!(job.status, job_manager_contract::JobStatus::Completed);
}

#[test]
fn test_timeout_auto_approve() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let mm = &ctx.mm;
    let jid = b32(env, 2);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &500_0000000i128);

    mgr.create_job(
        &jid, &b32(env, 88), &ctx.client_addr,
        &500_0000000i128,
    );
    mgr.accept_job(&jid, &ctx.freelancer);

    let hashes = Vec::from_array(env, [b32(env, 20), b32(env, 21)]);
    let pcts = Vec::from_array(env, [50u32, 50u32]);
    let deadlines = Vec::from_array(env, [500u64, 99_999u64]);
    mm.add_milestones(
        &jid, &ctx.client_addr, &ctx.freelancer,
        &500_0000000i128, &hashes, &pcts, &deadlines,
    );

    mm.submit_milestone(&jid, &0u32);

    // Advance ledger past deadline
    env.ledger().set(LedgerInfo {
        timestamp: 1000, // > 500
        ..env.ledger().get()
    });

    // Anyone can call check_timeout now
    mm.check_timeout(&jid, &0u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 250_0000000i128);
}

#[test]
fn test_cancel_open_job_refunds_client() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let jid = b32(env, 3);
    let initial = ctx.token.balance(&ctx.client_addr);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &200_0000000i128);

    mgr.create_job(
        &jid, &b32(env, 77), &ctx.client_addr,
        &200_0000000i128,
    );

    mgr.cancel_job(&jid);
    assert_eq!(ctx.token.balance(&ctx.client_addr), initial);
}

#[test]
fn test_single_milestone_100_pct() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let mm = &ctx.mm;
    let jid = b32(env, 4);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &100_0000000i128);

    mgr.create_job(
        &jid, &b32(env, 66), &ctx.client_addr,
        &100_0000000i128,
    );
    mgr.accept_job(&jid, &ctx.freelancer);

    let hashes = Vec::from_array(env, [b32(env, 40)]);
    let pcts = Vec::from_array(env, [100u32]);
    let deadlines = Vec::from_array(env, [9999u64]);
    mm.add_milestones(
        &jid, &ctx.client_addr, &ctx.freelancer,
        &100_0000000i128, &hashes, &pcts, &deadlines,
    );

    mm.submit_milestone(&jid, &0u32);
    mm.approve_milestone(&jid, &0u32);

    assert_eq!(ctx.token.balance(&ctx.freelancer), 100_0000000i128);
    assert!(mm.all_milestones_paid(&jid));

    mgr.complete_job(&jid);
    assert_eq!(mgr.get_job_status(&jid), job_manager_contract::JobStatus::Completed);
}

#[test]
#[should_panic(expected = "not all milestones are paid yet")]
fn test_complete_job_before_milestones_paid_panics() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let mm = &ctx.mm;
    let jid = b32(env, 5);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &100_0000000i128);
    mgr.create_job(&jid, &b32(env, 55), &ctx.client_addr, &100_0000000i128);
    mgr.accept_job(&jid, &ctx.freelancer);

    let hashes = Vec::from_array(env, [b32(env, 50)]);
    let pcts = Vec::from_array(env, [100u32]);
    let deadlines = Vec::from_array(env, [9999u64]);
    mm.add_milestones(
        &jid, &ctx.client_addr, &ctx.freelancer,
        &100_0000000i128, &hashes, &pcts, &deadlines,
    );

    // Try to complete without approving milestones
    mgr.complete_job(&jid);
}

#[test]
fn test_open_job_milestone_binding_on_accept() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let mm = &ctx.mm;
    let jid = b32(env, 6);

    // 1. Client deposits into escrow
    ctx.escrow.deposit(&jid, &ctx.client_addr, &100_0000000i128);

    // 2. Client creates job
    mgr.create_job(
        &jid,
        &b32(env, 66),
        &ctx.client_addr,
        &100_0000000i128,
    );

    // 3. Client registers milestones using client_addr as freelancer placeholder
    let hashes = Vec::from_array(env, [b32(env, 60)]);
    let pcts = Vec::from_array(env, [100u32]);
    let deadlines = Vec::from_array(env, [9999u64]);
    mm.add_milestones(
        &jid,
        &ctx.client_addr,
        &ctx.client_addr, // freelancer placeholder = client
        &100_0000000i128,
        &hashes,
        &pcts,
        &deadlines,
    );

    // Verify initially milestones freelancer is client
    let jm_initial = mm.get_milestones(&jid);
    assert_eq!(jm_initial.freelancer, ctx.client_addr);

    // 4. Freelancer accepts the job on JobManager, which should trigger bind_freelancer on MilestoneManager
    mgr.accept_job(&jid, &ctx.freelancer);

    // Verify milestones freelancer has been updated to freelancer
    let jm_after = mm.get_milestones(&jid);
    assert_eq!(jm_after.freelancer, ctx.freelancer);

    // 5. Freelancer submits milestone
    mm.submit_milestone(&jid, &0u32);

    // 6. Client approves
    mm.approve_milestone(&jid, &0u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 100_0000000i128);
}

