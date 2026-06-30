#!/bin/bash
set -e

echo "=========================================================="
echo "          SkillX Contract Build & Redeployment"
echo "=========================================================="

echo "Step 1: Building contracts..."
stellar contract build

echo "Step 2: Deploying Escrow contract..."
ESCROW_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/escrow_contract.wasm --source deployer --network testnet)
echo "Escrow Contract ID: $ESCROW_ID"

echo "Step 3: Deploying Job Manager contract..."
JOB_MGR_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/job_manager_contract.wasm --source deployer --network testnet)
echo "Job Manager Contract ID: $JOB_MGR_ID"

echo "Step 4: Deploying Milestone Manager contract..."
MILESTONE_MGR_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/milestone_manager_contract.wasm --source deployer --network testnet)
echo "Milestone Manager Contract ID: $MILESTONE_MGR_ID"

DEPLOYER_ADDR=$(stellar keys address deployer)
echo "Deployer Address: $DEPLOYER_ADDR"

echo "Step 5: Retrieving native XLM SAC contract ID..."
XLM_SAC=$(stellar contract id asset --asset native --network testnet)
echo "XLM SAC: $XLM_SAC"

echo "Step 6: Initializing Escrow contract..."
stellar contract invoke \
  --id "$ESCROW_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --job_manager "$JOB_MGR_ID" \
  --milestone_manager "$MILESTONE_MGR_ID" \
  --token_id "$XLM_SAC"

echo "Step 7: Initializing Job Manager contract..."
stellar contract invoke \
  --id "$JOB_MGR_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ADDR" \
  --escrow_contract "$ESCROW_ID" \
  --milestone_manager "$MILESTONE_MGR_ID"

echo "Step 8: Initializing Milestone Manager contract..."
stellar contract invoke \
  --id "$MILESTONE_MGR_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ADDR" \
  --escrow_contract "$ESCROW_ID" \
  --job_manager "$JOB_MGR_ID"

echo "Step 9: Updating frontend/.env file..."
ENV_FILE="frontend/.env"
if [ -f "$ENV_FILE" ]; then
  # Use temp file to update env variables cleanly
  grep -v "VITE_JOB_MANAGER_CONTRACT_ID" "$ENV_FILE" | \
  grep -v "VITE_ESCROW_CONTRACT_ID" | \
  grep -v "VITE_MILESTONE_MANAGER_CONTRACT_ID" > "$ENV_FILE.tmp"
  
  echo "VITE_JOB_MANAGER_CONTRACT_ID=$JOB_MGR_ID" >> "$ENV_FILE.tmp"
  echo "VITE_ESCROW_CONTRACT_ID=$ESCROW_ID" >> "$ENV_FILE.tmp"
  echo "VITE_MILESTONE_MANAGER_CONTRACT_ID=$MILESTONE_MGR_ID" >> "$ENV_FILE.tmp"
  
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  echo "✅ frontend/.env updated successfully!"
else
  echo "⚠️ frontend/.env not found! Creating a new one..."
  echo "VITE_API_BASE_URL=http://localhost:4000" > "$ENV_FILE"
  echo "VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org" >> "$ENV_FILE"
  echo "VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015" >> "$ENV_FILE"
  echo "VITE_JOB_MANAGER_CONTRACT_ID=$JOB_MGR_ID" >> "$ENV_FILE"
  echo "VITE_ESCROW_CONTRACT_ID=$ESCROW_ID" >> "$ENV_FILE"
  echo "VITE_MILESTONE_MANAGER_CONTRACT_ID=$MILESTONE_MGR_ID" >> "$ENV_FILE"
  echo "✅ Created frontend/.env!"
fi

echo ""
echo "=========================================================="
echo "                  Redeployment Summary"
echo "=========================================================="
echo "Escrow:            $ESCROW_ID"
echo "Job Manager:       $JOB_MGR_ID"
echo "Milestone Manager: $MILESTONE_MGR_ID"
echo "XLM SAC:           $XLM_SAC"
echo ""
echo "Stellar Expert Explorer links:"
echo "- Escrow:            https://stellar.expert/explorer/testnet/contract/$ESCROW_ID"
echo "- Job Manager:       https://stellar.expert/explorer/testnet/contract/$JOB_MGR_ID"
echo "- Milestone Manager: https://stellar.expert/explorer/testnet/contract/$MILESTONE_MGR_ID"
echo "=========================================================="
