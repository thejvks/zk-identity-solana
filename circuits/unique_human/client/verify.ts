import path from "path";
import {
  generateWitness,
  generateGroth16Proof,
  readProofFiles,
  createInstructionData,
} from "../../../lib/proof";
import {
  verifyOnChain,
  printTransactionResult,
  handleVerifyError,
} from "../../../lib/verify";

const CIRCUIT_DIR = path.resolve(__dirname, "..");
const CIRCUIT_NAME = "unique_human";
const PROGRAM_ID = process.env.UNIQUE_HUMAN_PROGRAM_ID || "";

async function main() {
  console.log("=== Unique Human: On-Chain Proof Verification ===\n");

  const config = { circuitDir: CIRCUIT_DIR, circuitName: CIRCUIT_NAME };

  console.log("1. Generating witness...");
  generateWitness(config);

  console.log("2. Generating Groth16 proof via Sunspot...");
  generateGroth16Proof(config);

  console.log("3. Reading proof files...");
  const proofResult = readProofFiles(config);
  const instructionData = createInstructionData(proofResult);

  console.log(`   Proof size: ${proofResult.proof.length} bytes`);
  console.log(`   Public witness: ${proofResult.publicWitness.length} bytes`);
  console.log(`   Instruction data: ${instructionData.length} bytes\n`);

  console.log("4. Verifying on-chain...");
  const sig = await verifyOnChain(instructionData, {
    rpcUrl: "https://api.devnet.solana.com",
    programId: PROGRAM_ID,
    walletPath: path.join(CIRCUIT_DIR, "keypair", "deployer.json"),
    computeUnits: 500_000,
  });

  printTransactionResult(sig);
}

main().catch(handleVerifyError);
