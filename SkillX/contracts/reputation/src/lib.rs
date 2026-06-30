#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ReputationStatus {
    None,
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationEntry {
    pub completed_jobs: u32,
    pub accepted_jobs: u32,
    pub total_paid_amount: i128,
    pub rating_sum: u32,
    pub rating_count: u32,
    pub last_completed_at: u64,
    pub last_completed_job_id: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct JobReputationState {
    pub job_id: BytesN<32>,
    pub freelancer: Address,
    pub client: Address,
    pub finalized: bool,
    pub paid_amount: i128,
    pub reviewed: bool,
    pub review_rating: u32,
    pub review_hash: BytesN<32>,
}

#[contracttype]
pub enum DataKey {
    Reputation(Address),
    JobReputation(BytesN<32>),
    Admin,
    JobManager,
    EscrowContract,
    Status,
}

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    pub fn initialize(env: Env, admin: Address, job_manager: Address, escrow_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::JobManager, &job_manager);
        env.storage().instance().set(&DataKey::EscrowContract, &escrow_contract);
        env.storage().instance().set(&DataKey::Status, &ReputationStatus::Initialized);
    }

    pub fn record_job_completion(
        env: Env,
        job_id: BytesN<32>,
        freelancer: Address,
        client: Address,
        paid_amount: i128,
        completed_at: u64,
    ) {
        Self::require_job_manager(&env);
        if paid_amount <= 0 {
            panic!("paid_amount must be positive");
        }
        if env.storage().persistent().has(&DataKey::JobReputation(job_id.clone())) {
            panic!("job reputation already recorded");
        }

        let mut profile = env
            .storage()
            .persistent()
            .get::<_, ReputationEntry>(&DataKey::Reputation(freelancer.clone()))
            .unwrap_or(ReputationEntry {
                completed_jobs: 0,
                accepted_jobs: 0,
                total_paid_amount: 0,
                rating_sum: 0,
                rating_count: 0,
                last_completed_at: 0,
                last_completed_job_id: BytesN::from_array(&env, &[0u8; 32]),
            });

        profile.completed_jobs += 1;
        profile.total_paid_amount += paid_amount;
        profile.last_completed_at = completed_at;
        profile.last_completed_job_id = job_id.clone();

        env.storage().persistent().set(&DataKey::Reputation(freelancer.clone()), &profile);

        let state = JobReputationState {
            job_id: job_id.clone(),
            freelancer: freelancer.clone(),
            client,
            finalized: true,
            paid_amount,
            reviewed: false,
            review_rating: 0,
            review_hash: BytesN::from_array(&env, &[0u8; 32]),
        };
        env.storage().persistent().set(&DataKey::JobReputation(job_id), &state);
    }

    pub fn submit_review(
        env: Env,
        job_id: BytesN<32>,
        client: Address,
        rating: u32,
        review_hash: BytesN<32>,
    ) {
        client.require_auth();
        let mut state = env
            .storage()
            .persistent()
            .get::<_, JobReputationState>(&DataKey::JobReputation(job_id.clone()))
            .unwrap_or_else(|| panic!("job reputation state not found"));

        if state.client != client {
            panic!("only the assigned client can submit a review");
        }
        if !state.finalized {
            panic!("job not finalized");
        }
        if state.reviewed {
            panic!("review already submitted");
        }
        if rating == 0 || rating > 5 {
            panic!("rating must be between 1 and 5");
        }

        state.reviewed = true;
        state.review_rating = rating;
        state.review_hash = review_hash;
        env.storage().persistent().set(&DataKey::JobReputation(job_id.clone()), &state);

        let mut profile = env
            .storage()
            .persistent()
            .get::<_, ReputationEntry>(&DataKey::Reputation(state.freelancer.clone()))
            .unwrap_or_else(|| panic!("reputation profile not found"));
        profile.rating_sum += rating;
        profile.rating_count += 1;
        env.storage().persistent().set(&DataKey::Reputation(state.freelancer), &profile);
    }

    pub fn record_acceptance(env: Env, freelancer: Address) {
        Self::require_job_manager(&env);
        let mut profile = env
            .storage()
            .persistent()
            .get::<_, ReputationEntry>(&DataKey::Reputation(freelancer.clone()))
            .unwrap_or(ReputationEntry {
                completed_jobs: 0,
                accepted_jobs: 0,
                total_paid_amount: 0,
                rating_sum: 0,
                rating_count: 0,
                last_completed_at: 0,
                last_completed_job_id: BytesN::from_array(&env, &[0u8; 32]),
            });
        profile.accepted_jobs += 1;
        env.storage().persistent().set(&DataKey::Reputation(freelancer), &profile);
    }

    pub fn get_reputation(env: Env, freelancer: Address) -> ReputationEntry {
        env.storage()
            .persistent()
            .get(&DataKey::Reputation(freelancer))
            .unwrap_or(ReputationEntry {
                completed_jobs: 0,
                accepted_jobs: 0,
                total_paid_amount: 0,
                rating_sum: 0,
                rating_count: 0,
                last_completed_at: 0,
                last_completed_job_id: BytesN::from_array(&env, &[0u8; 32]),
            })
    }

    pub fn get_job_reputation(env: Env, job_id: BytesN<32>) -> JobReputationState {
        env.storage()
            .persistent()
            .get(&DataKey::JobReputation(job_id))
            .unwrap_or_else(|| panic!("job reputation state not found"))
    }

    fn require_job_manager(env: &Env) {
        let jm: Address = env.storage().instance().get(&DataKey::JobManager).expect("not initialized");
        jm.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_record_completion_and_review() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let job_manager = Address::generate(&env);
        let escrow = Address::generate(&env);
        let contract_id = env.register(ReputationContract, ());
        let contract = ReputationContractClient::new(&env, &contract_id);
        contract.initialize(&admin, &job_manager, &escrow);

        let freelancer = Address::generate(&env);
        let client = Address::generate(&env);
        let job_id = BytesN::from_array(&env, &[7u8; 32]);

        contract.record_job_completion(&job_id, &freelancer, &client, &100, &1234);
        let profile = contract.get_reputation(&freelancer);
        assert_eq!(profile.completed_jobs, 1);
        assert_eq!(profile.total_paid_amount, 100);

        contract.submit_review(&job_id, &client, &5u32, &BytesN::from_array(&env, &[9u8; 32]));
        let updated = contract.get_reputation(&freelancer);
        assert_eq!(updated.rating_count, 1);
        assert_eq!(updated.rating_sum, 5);
    }
}
