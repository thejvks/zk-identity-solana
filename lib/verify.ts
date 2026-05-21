import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import fs from "fs";

export interface VerifyConfig {
  rpcUrl: string;
  programId: string;
  walletPath: string;
  computeUnits?: number;
}

/** Submit proof + public witness as instruction data to on-chain verifier */
export async function verifyOnChain(
  instructionData: Buffer,
  config: VerifyConfig,
): Promise<string> {
  if (!fs.existsSync(config.walletPath)) {
    throw new Error(`Wallet not found: ${config.walletPath}`);
  }

  const keypairBytes = new Uint8Array(
    JSON.parse(fs.readFileSync(config.walletPath, "utf-8")),
  );
  const wallet = Keypair.fromSecretKey(keypairBytes);
  const programId = new PublicKey(config.programId);

  console.log(`Wallet:  ${wallet.publicKey.toBase58()}`);
  console.log(`Program: ${programId.toBase58()}`);

  const connection = new Connection(config.rpcUrl, "confirmed");

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  if (balance < 10_000_000) {
    throw new Error("Insufficient balance. Run: solana airdrop 2");
  }

  const computeUnits = config.computeUnits ?? 500_000;

  const verifyInstruction = new TransactionInstruction({
    programId,
    keys: [],
    data: instructionData,
  });

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    verifyInstruction,
  );

  console.log("Sending verification transaction...");
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  return sig;
}

export function printTransactionResult(
  sig: string,
  cluster: string = "devnet",
): void {
  console.log(
    `\nTransaction: https://explorer.solana.com/tx/${sig}?cluster=${cluster}`,
  );
}

export function handleVerifyError(err: unknown): never {
  console.error("\nVerification failed!");
  if (err && typeof err === "object" && "logs" in err) {
    const e = err as { logs: string[] };
    console.error("\nProgram logs:");
    e.logs.forEach((log: string) => console.error(`  ${log}`));
  } else if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
}
