#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token::Client as TokenClient,
    Address, BytesN, Env,
};

// ─────────────────────────────────────────────────────────
//  Storage key types
// ─────────────────────────────────────────────────────────

/// All persistent storage keys used by this contract.
#[contracttype]
pub enum DataKey {
    /// Native XLM balance locked for a specific job.
    JobBalance(BytesN<32>),
    /// The client (depositor) for a specific job.
    JobClient(BytesN<32>),
    /// The authorised caller — must be JobManagerContract.
    JobManager,
    /// The XLM token contract address (Stellar Asset Contract for XLM).
    TokenId,
}

// ─────────────────────────────────────────────────────────
//  Contract
// ─────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // ─────────────────────────────────────────────────────
    //  Admin: one-time initialisation
    // ─────────────────────────────────────────────────────

    /// Must be called once immediately after deployment.
    ///
    /// * `job_manager` – address of the deployed JobManagerContract.
    ///   Only this address is allowed to call `release_payment` and `refund`.
    /// * `token_id`    – address of the Stellar Asset Contract (SAC) for XLM,
    ///   or any SEP-41 token used for payments.
    pub fn initialize(env: Env, job_manager: Address, token_id: Address) {
        // Prevent re-initialisation.
        if env.storage().instance().has(&DataKey::JobManager) {
            panic!("already initialised");
        }
        env.storage()
            .instance()
            .set(&DataKey::JobManager, &job_manager);
        env.storage()
            .instance()
            .set(&DataKey::TokenId, &token_id);
    }

    // ─────────────────────────────────────────────────────
    //  Public: client deposits funds for a job
    // ─────────────────────────────────────────────────────

    /// Transfer `amount` tokens from `client` into the escrow and lock them
    /// against `job_id`.
    ///
    /// Rules
    /// ─────
    /// • `client` must sign the transaction (Soroban `require_auth`).
    /// • A given `job_id` can be topped up by the original depositor only.
    /// • `amount` must be > 0.
    pub fn deposit(env: Env, job_id: BytesN<32>, client: Address, amount: i128) {
        // 1. Require the client's authorisation.
        client.require_auth();

        // 2. Validate amount.
        if amount <= 0 {
            panic!("amount must be positive");
        }

        // 3. If this job was already funded, only the original depositor can
        // top it up.
        let balance_key = DataKey::JobBalance(job_id.clone());
        let client_key = DataKey::JobClient(job_id.clone());
        if let Some(recorded_client) = env.storage().persistent().get::<_, Address>(&client_key) {
            if recorded_client != client {
                panic!("client mismatch");
            }
        }

        // 4. Pull tokens from the client into THIS contract.
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .expect("not initialised");
        let token = TokenClient::new(&env, &token_id);
        token.transfer(&client, &env.current_contract_address(), &amount);

        // 5. Record the locked balance and the client address.
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + amount));
        env.storage().persistent().set(&client_key, &client);
    }

    // ─────────────────────────────────────────────────────
    //  Restricted: release a milestone payment to freelancer
    // ─────────────────────────────────────────────────────

    /// Send `amount` tokens to `freelancer` and deduct from the job's escrow
    /// balance.
    ///
    /// Rules
    /// ─────
    /// • Only the JobManagerContract may call this function.
    /// • `amount` must not exceed the remaining balance (prevents over-payment).
    /// • Panics if the job has no funded balance.
    pub fn release_payment(
        env: Env,
        job_id: BytesN<32>,
        freelancer: Address,
        amount: i128,
    ) {
        // 1. Only JobManager is allowed.
        Self::require_job_manager(&env);

        // 2. Load current balance.
        let balance_key = DataKey::JobBalance(job_id.clone());
        let balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .expect("job not funded");

        // 3. Guard against over-payment.
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if amount > balance {
            panic!("insufficient escrow balance");
        }

        // 4. Transfer to freelancer.
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .expect("not initialised");
        let token = TokenClient::new(&env, &token_id);
        token.transfer(&env.current_contract_address(), &freelancer, &amount);

        // 5. Update or remove balance.
        let new_balance = balance - amount;
        if new_balance == 0 {
            env.storage().persistent().remove(&balance_key);
            env.storage()
                .persistent()
                .remove(&DataKey::JobClient(job_id));
        } else {
            env.storage()
                .persistent()
                .set(&balance_key, &new_balance);
        }
    }

    // ─────────────────────────────────────────────────────
    //  Restricted: refund entire remaining balance to client
    // ─────────────────────────────────────────────────────

    /// Return all remaining locked funds for `job_id` back to `client`.
    ///
    /// Rules
    /// ─────
    /// • Only the JobManagerContract may call this function.
    /// • The `client` address is verified against the recorded depositor to
    ///   prevent funds being redirected to an arbitrary address.
    /// • Clears all storage for the job (prevents double-refund).
    pub fn refund(env: Env, job_id: BytesN<32>, client: Address) {
        // 1. Only JobManager is allowed.
        Self::require_job_manager(&env);

        // 2. Load balance.
        let balance_key = DataKey::JobBalance(job_id.clone());
        let balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .expect("job not funded or already refunded");

        // 3. Verify the client matches the original depositor.
        let recorded_client: Address = env
            .storage()
            .persistent()
            .get(&DataKey::JobClient(job_id.clone()))
            .expect("client record missing");
        if recorded_client != client {
            panic!("client mismatch");
        }

        // 4. Transfer back to client.
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .expect("not initialised");
        let token = TokenClient::new(&env, &token_id);
        token.transfer(&env.current_contract_address(), &client, &balance);

        // 5. Clear storage — prevents double-refund.
        env.storage().persistent().remove(&balance_key);
        env.storage()
            .persistent()
            .remove(&DataKey::JobClient(job_id));
    }

    // ─────────────────────────────────────────────────────
    //  View: read-only balance query
    // ─────────────────────────────────────────────────────

    /// Returns the currently locked balance for `job_id`, or 0 if the job is
    /// not funded (or has been fully paid / refunded).
    pub fn get_balance(env: Env, job_id: BytesN<32>) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::JobBalance(job_id))
            .unwrap_or(0)
    }

    // ─────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────

    /// Panics unless the transaction invoker is the registered JobManager.
    fn require_job_manager(env: &Env) {
        let job_manager: Address = env
            .storage()
            .instance()
            .get(&DataKey::JobManager)
            .expect("not initialised");
        // `require_auth` checks that this address signed the current
        // transaction (or authorised it through a sub-invocation).
        job_manager.require_auth();
    }
}

// ─────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, BytesN, Env,
    };

    // ── helpers ────────────────────────────────────────────

    fn job_id(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[1u8; 32])
    }

    fn setup() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy a mock SAC (Stellar Asset Contract) for XLM.
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();

        // Deploy the escrow contract.
        let escrow_id = env.register(EscrowContract, ());
        let escrow = EscrowContractClient::new(&env, &escrow_id);

        let job_manager = Address::generate(&env);
        let client_addr = Address::generate(&env);

        // Mint some tokens to client.
        let sac = StellarAssetClient::new(&env, &token_id);
        sac.mint(&client_addr, &1_000_0000000i128); // 1 000 XLM in stroops

        // Initialise escrow.
        escrow.initialize(&job_manager, &token_id);

        (env, escrow_id, token_id, job_manager, client_addr)
    }

    // ── tests ──────────────────────────────────────────────

    #[test]
    fn test_deposit_and_balance() {
        let (env, escrow_id, _, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &500_0000000i128);
        assert_eq!(escrow.get_balance(&jid), 500_0000000i128);
    }

    #[test]
    fn test_deposit_can_top_up_same_job() {
        let (env, escrow_id, _, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &100_0000000i128);
        escrow.deposit(&jid, &client_addr, &100_0000000i128);

        assert_eq!(escrow.get_balance(&jid), 200_0000000i128);
    }

    #[test]
    #[should_panic(expected = "client mismatch")]
    fn test_deposit_rejects_different_client_top_up() {
        let (env, escrow_id, _, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let other_client = Address::generate(&env);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &100_0000000i128);
        escrow.deposit(&jid, &other_client, &100_0000000i128);
    }

    #[test]
    fn test_release_payment() {
        let (env, escrow_id, token_id, _job_manager, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let token = TokenClient::new(&env, &token_id);
        let freelancer = Address::generate(&env);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &500_0000000i128);

        // JobManager releases 200 XLM to freelancer.
        env.mock_all_auths();
        escrow.release_payment(&jid, &freelancer, &200_0000000i128);

        assert_eq!(escrow.get_balance(&jid), 300_0000000i128);
        assert_eq!(token.balance(&freelancer), 200_0000000i128);
    }

    #[test]
    #[should_panic(expected = "insufficient escrow balance")]
    fn test_release_over_balance_panics() {
        let (env, escrow_id, _, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let freelancer = Address::generate(&env);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &100_0000000i128);
        escrow.release_payment(&jid, &freelancer, &200_0000000i128);
    }

    #[test]
    fn test_refund_returns_full_balance() {
        let (env, escrow_id, token_id, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let token = TokenClient::new(&env, &token_id);
        let jid = job_id(&env);
        let initial_balance = token.balance(&client_addr);

        escrow.deposit(&jid, &client_addr, &300_0000000i128);
        escrow.refund(&jid, &client_addr);

        assert_eq!(token.balance(&client_addr), initial_balance);
        assert_eq!(escrow.get_balance(&jid), 0);
    }

    #[test]
    #[should_panic(expected = "job not funded or already refunded")]
    fn test_double_refund_panics() {
        let (env, escrow_id, _, _, client_addr) = setup();
        let escrow = EscrowContractClient::new(&env, &escrow_id);
        let jid = job_id(&env);

        escrow.deposit(&jid, &client_addr, &100_0000000i128);
        escrow.refund(&jid, &client_addr);
        escrow.refund(&jid, &client_addr); // should panic
    }
}
