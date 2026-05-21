import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ProofResult {
  proof: Buffer;
  publicWitness: Buffer;
}

export interface CircuitConfig {
  circuitDir: string;
  circuitName: string;
}

function getTargetDir(config: CircuitConfig): string {
  return path.join(config.circuitDir, "target");
}

export function getProverTomlPath(config: CircuitConfig): string {
  return path.join(config.circuitDir, "Prover.toml");
}

function getAcirPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.json`);
}

function getWitnessPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.gz`);
}

function getCcsPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.ccs`);
}

function getProvingKeyPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.pk`);
}

function getProofPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.proof`);
}

function getPublicWitnessPath(config: CircuitConfig): string {
  return path.join(getTargetDir(config), `${config.circuitName}.pw`);
}

/** Step 1: Generate witness from Prover.toml inputs */
export function generateWitness(config: CircuitConfig): void {
  execSync("nargo execute", {
    cwd: config.circuitDir,
    stdio: "pipe",
  });
}

/** Step 2: Generate Groth16 proof via Sunspot */
export function generateGroth16Proof(config: CircuitConfig): void {
  const acirPath = getAcirPath(config);
  const witnessPath = getWitnessPath(config);
  const ccsPath = getCcsPath(config);
  const pkPath = getProvingKeyPath(config);

  execSync(`sunspot prove ${acirPath} ${witnessPath} ${ccsPath} ${pkPath}`, {
    cwd: config.circuitDir,
    stdio: "pipe",
  });
}

/** Read generated proof and public witness files */
export function readProofFiles(config: CircuitConfig): ProofResult {
  const proof = fs.readFileSync(getProofPath(config));
  const publicWitness = fs.readFileSync(getPublicWitnessPath(config));
  return { proof, publicWitness };
}

/** Concatenate proof + public witness for on-chain instruction data */
export function createInstructionData(proofResult: ProofResult): Buffer {
  return Buffer.concat([proofResult.proof, proofResult.publicWitness]);
}

/** Write inputs to Prover.toml */
export function writeProverToml(
  config: CircuitConfig,
  inputs: Record<string, string | number>,
): void {
  const tomlContent = Object.entries(inputs)
    .map(([key, value]) => `${key} = "${value}"`)
    .join("\n");
  fs.writeFileSync(getProverTomlPath(config), tomlContent + "\n");
}

/** Full pipeline: write inputs → generate witness → prove → read files */
export function generateProofWithInputs(
  config: CircuitConfig,
  inputs: Record<string, string | number>,
): ProofResult {
  writeProverToml(config, inputs);
  generateWitness(config);
  generateGroth16Proof(config);
  return readProofFiles(config);
}
