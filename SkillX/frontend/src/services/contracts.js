import { getAddress, signTransaction } from "@stellar/freighter-api";
import {
  Address,
  Contract,
  Networks,
  rpc,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";

const rpcUrl = import.meta.env.VITE_SOROBAN_RPC_URL;
const networkPassphrase =
  import.meta.env.VITE_NETWORK_PASSPHRASE || Networks.TESTNET;
const jobManagerContractId = import.meta.env.VITE_JOB_MANAGER_CONTRACT_ID;
const escrowContractId = import.meta.env.VITE_ESCROW_CONTRACT_ID;

function getServer() {
  if (!rpcUrl) {
    throw new Error("Missing VITE_SOROBAN_RPC_URL in frontend .env");
  }
  return new rpc.Server(rpcUrl);
}

function ensureContractId(contractId) {
  if (!contractId) {
    throw new Error("Missing contract ID in frontend .env");
  }
  if (!StrKey.isValidContract(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }
}

function ensureStellarAddress(address) {
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`Invalid Stellar address: ${address || "undefined"}`);
  }
}

function normalizeFreighterAddress(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  return result.address || result.publicKey || "";
}

async function buildAndSendContractTx(contractId, method, args = []) {
  ensureContractId(contractId);

  const server = getServer();
  const addressResult = await getAddress();
  if (addressResult.error) throw new Error(addressResult.error);
  const walletAddress = normalizeFreighterAddress(addressResult);
  ensureStellarAddress(walletAddress);

  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);
  const operation = contract.call(method, ...args);

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase
  });

  if (signed.error) throw new Error(signed.error);
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, networkPassphrase);
  return server.sendTransaction(signedTx);
}

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

export const contracts = {
  async createJobOnChain({
    jobIdHex,
    jobHashHex,
    clientAddress,
    totalAmount,
    milestoneHashesHex,
    milestonePercentages,
    milestoneDeadlines
  }) {
    ensureStellarAddress(clientAddress);
    const args = [
      hexToBytesScVal(jobIdHex),
      hexToBytesScVal(jobHashHex),
      Address.fromString(clientAddress).toScVal(),
      nativeToScVal(totalAmount, { type: "i128" }),
      xdr.ScVal.scvVec((milestoneHashesHex || []).map((h) => hexToBytesScVal(h))),
      xdr.ScVal.scvVec(
        (milestonePercentages || []).map((p) => nativeToScVal(p, { type: "u32" }))
      ),
      xdr.ScVal.scvVec(
        (milestoneDeadlines || []).map((d) => nativeToScVal(d, { type: "u64" }))
      )
    ];
    return buildAndSendContractTx(jobManagerContractId, "create_job", args);
  },
  async acceptJobOnChain(jobIdHex, freelancerAddress) {
    ensureStellarAddress(freelancerAddress);
    const args = [
      hexToBytesScVal(jobIdHex),
      Address.fromString(freelancerAddress).toScVal()
    ];
    return buildAndSendContractTx(jobManagerContractId, "accept_job", args);
  },
  async submitMilestoneOnChain(jobIdHex, milestoneIndex) {
    const args = [
      hexToBytesScVal(jobIdHex),
      nativeToScVal(milestoneIndex, { type: "u32" })
    ];
    return buildAndSendContractTx(jobManagerContractId, "submit_milestone", args);
  },
  async depositEscrowOnChain(jobIdHex, clientAddress, amount) {
    ensureStellarAddress(clientAddress);
    const args = [
      hexToBytesScVal(jobIdHex),
      Address.fromString(clientAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" })
    ];
    return buildAndSendContractTx(escrowContractId, "deposit", args);
  }
};
