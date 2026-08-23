import { getAddress, signTransaction } from "@stellar/freighter-api";
import {
  Address,
  Contract,
  Networks,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";

// ═══════════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════════

const rpcUrl = import.meta.env.VITE_SOROBAN_RPC_URL;
const networkPassphrase =
  import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
const jobManagerContractId = import.meta.env.VITE_JOB_MANAGER_CONTRACT_ID;
const escrowContractId = import.meta.env.VITE_ESCROW_CONTRACT_ID;
const milestoneManagerContractId = import.meta.env.VITE_MILESTONE_MANAGER_CONTRACT_ID;

// ═══════════════════════════════════════════════════════════════
//  Validation Helpers
// ═══════════════════════════════════════════════════════════════

function getServer() {
  if (!rpcUrl) {
    throw new Error("Missing VITE_SOROBAN_RPC_URL in frontend .env");
  }
  return new rpc.Server(rpcUrl);
}

function ensureContractId(contractId, envName) {
  if (!contractId) {
    throw new Error(
      `Missing ${envName} in frontend .env. Add it to SkillX/frontend/.env and restart the dev server.`
    );
  }
  if (!StrKey.isValidContract(contractId)) {
    throw new Error(`Invalid ${envName} contract ID format: ${contractId}`);
  }
}

function ensureStellarAddress(address) {
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`Invalid Stellar address: ${address || "undefined"}`);
  }
}

function normalizeWallet(value) {
  return value?.trim().toUpperCase() || "";
}

// ═══════════════════════════════════════════════════════════════
//  Freighter Wallet
// ═══════════════════════════════════════════════════════════════

function normalizeFreighterAddress(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return result.address || result.publicKey || "";
}

async function getFreighterWalletAddress() {
  const addressResult = await getAddress();
  if (addressResult.error) throw new Error(addressResult.error);
  const walletAddress = normalizeFreighterAddress(addressResult);
  ensureStellarAddress(walletAddress);
  return walletAddress;
}

// ═══════════════════════════════════════════════════════════════
//  Transaction Execution Core
// ═══════════════════════════════════════════════════════════════

async function buildAndSendContractTx(
  contractId,
  envName,
  method,
  args = [],
  options = {}
) {
  ensureContractId(contractId, envName);

  const server = getServer();
  const walletAddress = await getFreighterWalletAddress();

  if (
    options.expectedSigner &&
    normalizeWallet(walletAddress) !== normalizeWallet(options.expectedSigner)
  ) {
    throw new Error(
      `Freighter is using ${walletAddress}, but this action must be signed by ${options.expectedSigner}. Switch Freighter accounts and reconnect.`
    );
  }

  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase
  });

  if (signed.error) throw new Error(signed.error);

  // Send the raw signed XDR directly — avoids "Bad union switch: 1" issues
  // from parsing between Freighter v4 and SDK v13 envelope formats.
  const signedXdr = signed.signedTxXdr || signed;
  const sent = await sendRawTransaction(signedXdr);
  return waitForTransaction(server, sent, method);
}

async function sendRawTransaction(signedXdr) {
  return rpcRequest("sendTransaction", { transaction: signedXdr });
}

async function waitForTransaction(server, sent, method) {
  if (sent.errorResult) {
    throw new Error(`Transaction ${method} failed before submission: ${sent.errorResult}`);
  }
  if (!sent.hash) {
    return sent;
  }

  const timeoutAt = Date.now() + 30000;
  let lastStatus = sent.status || "PENDING";

  while (Date.now() < timeoutAt) {
    const result = await getTransactionStatus(sent.hash);
    lastStatus = result.status || lastStatus;

    if (result.status === "SUCCESS") return { ...sent, result };
    if (result.status === "FAILED") {
      throw new Error(`Transaction ${method} failed on-chain.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction ${method} was not confirmed in time. Last status: ${lastStatus}.`);
}

async function getTransactionStatus(hash) {
  return rpcRequest("getTransaction", { hash });
}

async function rpcRequest(method, params) {
  if (!rpcUrl) throw new Error("Missing VITE_SOROBAN_RPC_URL in frontend .env");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Soroban RPC returned ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || `${method} failed`);
    return data.result || {};
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Soroban RPC ${method} timed out`);
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Read-Only Simulation
// ═══════════════════════════════════════════════════════════════

async function simulateContractCall(contractId, envName, method, args = []) {
  ensureContractId(contractId, envName);

  const server = getServer();
  const walletAddress = await getFreighterWalletAddress();

  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if ("error" in simulation && simulation.error) {
    throw new Error(simulation.error);
  }
  if (!simulation.result?.retval) {
    throw new Error(`No simulation result returned for ${method}`);
  }
  return scValToNative(simulation.result.retval);
}

// ═══════════════════════════════════════════════════════════════
//  Byte Helpers
// ═══════════════════════════════════════════════════════════════

function ensureHex32(hex) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Expected a 32-byte hex string");
  }
}

function hexToBytesScVal(hex) {
  ensureHex32(hex);
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));
  return xdr.ScVal.scvBytes(bytes);
}

// ═══════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════

export const contracts = {
  getConnectedWalletAddress: getFreighterWalletAddress,

  // ─── JOB MANAGER ─────────────────────────────────────────────

  async createJobOnChain({ jobIdHex, jobHashHex, clientAddress, totalAmount }) {
    ensureStellarAddress(clientAddress);
    return buildAndSendContractTx(
      jobManagerContractId,
      "VITE_JOB_MANAGER_CONTRACT_ID",
      "create_job",
      [
        hexToBytesScVal(jobIdHex),
        hexToBytesScVal(jobHashHex),
        Address.fromString(clientAddress).toScVal(),
        nativeToScVal(totalAmount, { type: "i128" }),
      ],
      { expectedSigner: clientAddress }
    );
  },

  async acceptJobOnChain(jobIdHex, freelancerAddress) {
    ensureStellarAddress(freelancerAddress);
    return buildAndSendContractTx(
      jobManagerContractId,
      "VITE_JOB_MANAGER_CONTRACT_ID",
      "accept_job",
      [
        hexToBytesScVal(jobIdHex),
        Address.fromString(freelancerAddress).toScVal()
      ],
      { expectedSigner: freelancerAddress }
    );
  },

  async completeJobOnChain(jobIdHex, clientAddress) {
    return buildAndSendContractTx(
      jobManagerContractId,
      "VITE_JOB_MANAGER_CONTRACT_ID",
      "complete_job",
      [hexToBytesScVal(jobIdHex)],
      clientAddress ? { expectedSigner: clientAddress } : {}
    );
  },

  async getJobOnChain(jobIdHex) {
    return simulateContractCall(
      jobManagerContractId,
      "VITE_JOB_MANAGER_CONTRACT_ID",
      "get_job",
      [hexToBytesScVal(jobIdHex)]
    );
  },

  async getJobStatusOnChain(jobIdHex) {
    return simulateContractCall(
      jobManagerContractId,
      "VITE_JOB_MANAGER_CONTRACT_ID",
      "get_job_status",
      [hexToBytesScVal(jobIdHex)]
    );
  },

  // ─── MILESTONE MANAGER ──────────────────────────────────────

  async addMilestonesOnChain({
    jobIdHex,
    clientAddress,
    freelancerAddress,
    totalAmount,
    milestoneHashesHex,
    milestonePercentages,
    milestoneDeadlines,
  }) {
    ensureStellarAddress(clientAddress);
    ensureStellarAddress(freelancerAddress);
    return buildAndSendContractTx(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "add_milestones",
      [
        hexToBytesScVal(jobIdHex),
        Address.fromString(clientAddress).toScVal(),
        Address.fromString(freelancerAddress).toScVal(),
        nativeToScVal(totalAmount, { type: "i128" }),
        xdr.ScVal.scvVec((milestoneHashesHex || []).map((h) => hexToBytesScVal(h))),
        xdr.ScVal.scvVec(
          (milestonePercentages || []).map((p) => nativeToScVal(p, { type: "u32" }))
        ),
        xdr.ScVal.scvVec(
          (milestoneDeadlines || []).map((d) => nativeToScVal(d, { type: "u64" }))
        ),
      ],
      { expectedSigner: clientAddress }
    );
  },

  async submitMilestoneOnChain(jobIdHex, milestoneIndex, freelancerAddress) {
    return buildAndSendContractTx(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "submit_milestone",
      [
        hexToBytesScVal(jobIdHex),
        nativeToScVal(milestoneIndex, { type: "u32" })
      ],
      freelancerAddress ? { expectedSigner: freelancerAddress } : {}
    );
  },

  async approveMilestoneOnChain(jobIdHex, milestoneIndex, clientAddress) {
    return buildAndSendContractTx(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "approve_milestone",
      [
        hexToBytesScVal(jobIdHex),
        nativeToScVal(milestoneIndex, { type: "u32" })
      ],
      clientAddress ? { expectedSigner: clientAddress } : {}
    );
  },

  async getMilestoneOnChain(jobIdHex, milestoneIndex) {
    return simulateContractCall(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "get_milestone",
      [
        hexToBytesScVal(jobIdHex),
        nativeToScVal(milestoneIndex, { type: "u32" })
      ]
    );
  },

  async getMilestonesOnChain(jobIdHex) {
    return simulateContractCall(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "get_milestones",
      [hexToBytesScVal(jobIdHex)]
    );
  },

  async allMilestonesPaidOnChain(jobIdHex) {
    return simulateContractCall(
      milestoneManagerContractId,
      "VITE_MILESTONE_MANAGER_CONTRACT_ID",
      "all_milestones_paid",
      [hexToBytesScVal(jobIdHex)]
    );
  },

  // ─── ESCROW ─────────────────────────────────────────────────

  async depositEscrowOnChain(jobIdHex, clientAddress, amount) {
    ensureStellarAddress(clientAddress);
    return buildAndSendContractTx(
      escrowContractId,
      "VITE_ESCROW_CONTRACT_ID",
      "deposit",
      [
        hexToBytesScVal(jobIdHex),
        Address.fromString(clientAddress).toScVal(),
        nativeToScVal(amount, { type: "i128" })
      ],
      { expectedSigner: clientAddress }
    );
  },

  async getEscrowBalanceOnChain(jobIdHex) {
    return simulateContractCall(
      escrowContractId,
      "VITE_ESCROW_CONTRACT_ID",
      "get_balance",
      [hexToBytesScVal(jobIdHex)]
    );
  },
};
