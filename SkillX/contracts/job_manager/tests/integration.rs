//! Integration test: full end-to-end flow with both contracts deployed.
//!
//! Run with:
//!   cargo test --test integration -- --nocapture
//!
//! This test deploys BOTH contracts into the same Soroban test environment,
//! wires them together via initialize(), then exercises the full lifecycle:
//!   create_job → accept_job → submit_milestone → approve_milestone (cross-call)
//!
//! It also tests the timeout path.

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, Vec,
};

// Import the two contracts.
use escrow_contract::{EscrowContract, EscrowContractClient};
use job_manager_contract::{JobManagerContract, JobManagerContractClient};

// ── helpers ──────────────────────────────────────────────────────────────────

fn b32(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

struct Ctx {
    env: Env,
    mgr: JobManagerContractClient<'static>,
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

    let admin = Address::generate(&env);

    // Wire them together
    escrow_client.initialize(&mgr_id, &token_id);
    mgr.initialize(&admin, &escrow_id);

    // ── Mint tokens to client ─────────────────────────────────────────────
    let client_addr = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let sac = StellarAssetClient::new(&env, &token_id);
    sac.mint(&client_addr, &1_000_0000000i128);

    // ── Client approves escrow to pull funds ──────────────────────────────
    let token = TokenClient::new(&env, &token_id);

    Ctx {
        env,
        mgr,
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
    let jid = b32(env, 1);

    // 1. Client deposits into escrow and creates job
    // (In production: backend calls escrow.deposit first, then create_job)
    let hashes = Vec::from_array(env, [b32(env, 10), b32(env, 11)]);
    let pcts = Vec::from_array(env, [60u32, 40u32]);
    let deadlines = Vec::from_array(env, [9_999u64, 99_999u64]);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &1_000_0000000i128);

    mgr.create_job(
        &jid,
        &b32(env, 99),
        &ctx.client_addr,
        &1_000_0000000i128,
        &hashes,
        &pcts,
        &deadlines,
    );

    // 2. Freelancer accepts
    mgr.accept_job(&jid, &ctx.freelancer);

    // 3. Freelancer submits milestone 0
    mgr.submit_milestone(&jid, &0u32);

    // 4. Client approves → cross-contract call → escrow releases 600 XLM
    mgr.approve_milestone(&jid, &0u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 600_0000000i128);

    // 5. Freelancer submits milestone 1
    mgr.submit_milestone(&jid, &1u32);

    // 6. Client approves final milestone → job Completed
    mgr.approve_milestone(&jid, &1u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 1_000_0000000i128);

    let job = mgr.get_job(&jid);
    assert_eq!(job.status, job_manager_contract::JobStatus::Completed);
}

#[test]
fn test_timeout_auto_approve() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let jid = b32(env, 2);

    let hashes = Vec::from_array(env, [b32(env, 20), b32(env, 21)]);
    let pcts = Vec::from_array(env, [50u32, 50u32]);
    let deadlines = Vec::from_array(env, [500u64, 99_999u64]);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &500_0000000i128);

    mgr.create_job(
        &jid, &b32(env, 88), &ctx.client_addr,
        &500_0000000i128, &hashes, &pcts, &deadlines,
    );
    mgr.accept_job(&jid, &ctx.freelancer);
    mgr.submit_milestone(&jid, &0u32);

    // Advance ledger past deadline
    env.ledger().set(LedgerInfo {
        timestamp: 1000, // > 500
        ..env.ledger().get()
    });

    // Anyone can call check_timeout now
    mgr.check_timeout(&jid, &0u32);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 250_0000000i128);
}

#[test]
fn test_cancel_open_job_refunds_client() {
    let ctx = setup_full();
    let env = &ctx.env;
    let mgr = &ctx.mgr;
    let jid = b32(env, 3);
    let initial = ctx.token.balance(&ctx.client_addr);

    let hashes = Vec::from_array(env, [b32(env, 30)]);
    let pcts = Vec::from_array(env, [100u32]);
    let deadlines = Vec::from_array(env, [9999u64]);

    ctx.escrow.deposit(&jid, &ctx.client_addr, &200_0000000i128);

    mgr.create_job(
        &jid, &b32(env, 77), &ctx.client_addr,
        &200_0000000i128, &hashes, &pcts, &deadlines,
    );

    mgr.cancel_job(&jid);
    assert_eq!(ctx.token.balance(&ctx.client_addr), initial);
}
