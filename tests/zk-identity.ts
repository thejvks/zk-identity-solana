import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZkIdentity } from "../target/types/zk_identity";
import { ReputationOracle } from "../target/types/reputation_oracle";
import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";

describe("zk-identity (solana)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const zkProgram = anchor.workspace.ZkIdentity as Program<ZkIdentity>;
  const repProgram = anchor.workspace.ReputationOracle as Program<ReputationOracle>;

  const authority = provider.wallet;

  const mockNullifier = new Uint8Array(32);
  mockNullifier[0] = 1;
  const mockCommitment = new Uint8Array(32);
  mockCommitment[0] = 2;
  const mockProofA = new Uint8Array(64);
  const mockProofB = new Uint8Array(128);
  const mockProofC = new Uint8Array(64);

  let registryPda: PublicKey;

  it("initializes the registry", async () => {
    [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry")],
      zkProgram.programId
    );

    await zkProgram.methods
      .initialize()
      .accounts({
        registry: registryPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const registry = await zkProgram.account.registry.fetch(registryPda);
    expect(registry.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(registry.totalAttestations.toNumber()).to.equal(0);
  });

  it("verifies and attests a valid age claim", async () => {
    const [attestationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), Buffer.from(mockNullifier)],
      zkProgram.programId
    );
    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), authority.publicKey.toBuffer()],
      zkProgram.programId
    );

    await zkProgram.methods
      .verifyAndAttest(
        Array.from(mockNullifier),
        Array.from(mockCommitment),
        1, 72,
        Array.from(mockProofA),
        Array.from(mockProofB),
        Array.from(mockProofC)
      )
      .accounts({
        attestation: attestationPda,
        userProfile: profilePda,
        registry: registryPda,
        user: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const attestation = await zkProgram.account.attestation.fetch(attestationPda);
    expect(attestation.claimType).to.equal(1);
    expect(attestation.reputationScore).to.equal(72);
    expect(attestation.revoked).to.equal(false);
  });

  it("rejects duplicate nullifier", async () => {
    const [attestationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), Buffer.from(mockNullifier)],
      zkProgram.programId
    );
    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), authority.publicKey.toBuffer()],
      zkProgram.programId
    );

    try {
      await zkProgram.methods
        .verifyAndAttest(
          Array.from(mockNullifier),
          Array.from(mockCommitment),
          1, 50,
          Array.from(mockProofA),
          Array.from(mockProofB),
          Array.from(mockProofC)
        )
        .accounts({
          attestation: attestationPda,
          userProfile: profilePda,
          registry: registryPda,
          user: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).to.exist;
    }
  });

  it("allows self-revocation", async () => {
    const [attestationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), Buffer.from(mockNullifier)],
      zkProgram.programId
    );

    await zkProgram.methods
      .revokeAttestation()
      .accounts({
        attestation: attestationPda,
        user: authority.publicKey,
      })
      .rpc();

    const attestation = await zkProgram.account.attestation.fetch(attestationPda);
    expect(attestation.revoked).to.equal(true);
  });

  it("prevents unauthorized revocation", async () => {
    const [attestationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), Buffer.from(mockNullifier)],
      zkProgram.programId
    );
    const impostor = Keypair.generate();

    const sig = await provider.connection.requestAirdrop(
      impostor.publicKey,
      1_000_000_000
    );
    await provider.connection.confirmTransaction(sig);

    try {
      await zkProgram.methods
        .revokeAttestation()
        .accounts({
          attestation: attestationPda,
          user: impostor.publicKey,
        })
        .signers([impostor])
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("UnauthorizedRevocation");
    }
  });

  it("initializes reputation oracle", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_config")],
      repProgram.programId
    );

    await repProgram.methods
      .initialize()
      .accounts({
        config: configPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await repProgram.account.oracleConfig.fetch(configPda);
    expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
  });

  it("rejects scores above 100", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_config")],
      repProgram.programId
    );
    const [oracleEntryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), authority.publicKey.toBuffer()],
      repProgram.programId
    );

    await repProgram.methods
      .setOracleStatus(authority.publicKey, true)
      .accounts({
        oracleEntry: oracleEntryPda,
        config: configPda,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const scoreNullifier = new Uint8Array(32);
    scoreNullifier[0] = 99;
    const [scorePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("score"), Buffer.from(scoreNullifier)],
      repProgram.programId
    );

    try {
      await repProgram.methods
        .submitScore(Array.from(scoreNullifier), 150)
        .accounts({
          scoreAccount: scorePda,
          oracleEntry: oracleEntryPda,
          oracle: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err.error.errorCode.code).to.equal("InvalidScore");
    }
  });
});
