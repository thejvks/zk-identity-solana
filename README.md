# ZK-Identity — Solana

> **Prove who you are. Reveal nothing.**

Zero-Knowledge identity verification on Solana — built with Anchor framework, Groth16 proofs, and an on-chain reputation oracle.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange)](programs/)
[![Anchor](https://img.shields.io/badge/Anchor-0.30.1-blue)](programs/)

---

## Features

| Feature | Description |
|---|---|
| **Age Proof** | Prove `age >= N` without revealing your birthdate |
| **Unique Human** | Sybil-resistance — one proof per real person per context |
| **Reputation Oracle** | On-chain reputation scores anchored to ZK nullifiers |
| **Revocable** | Self-revoke any attestation at any time |
| **PDA-based Storage** | All state stored in Program Derived Addresses |

---

## Prerequisites

- [Rust](https://rustup.rs/) (1.75+)
- [Solana CLI](https://docs.solanalabs.com/cli/install) (1.18+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.30+)
- [Node.js](https://nodejs.org/) (20+)

---

## Quick Start

```bash
git clone https://github.com/thejvks/zk-identity-solana
cd zk-identity-solana
npm install
```

### Build

```bash
anchor build
```

### Test (local validator)

```bash
anchor test
```

### Deploy to Devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy
```

---

## Programs

### zk_identity

| Instruction | Description |
|---|---|
| `initialize` | Set up the global registry |
| `register_verifier` | Register a verifier key for a claim type |
| `verify_and_attest` | Submit a ZK proof and create an attestation |
| `has_claim` | Check if a user has a verified claim |
| `revoke_attestation` | Self-revoke an attestation |

### reputation_oracle

| Instruction | Description |
|---|---|
| `initialize` | Set up the oracle config |
| `set_oracle_status` | Authorize/revoke oracle signers |
| `submit_score` | Submit a reputation score (0-100) |

---

## Architecture

```
User Device                              Solana
+---------------+                      +---------------------+
| Circom proof  | ---- proof ------>   | zk_identity program |
| (client-side) |                      |   PDA: attestation  |
+---------------+                      |   PDA: user_profile |
                                       +---------------------+
                                       | reputation_oracle   |
                                       |   PDA: score_account|
                                       +---------------------+
```

The same Circom circuits (AgeVerifier, UniqueHuman) generate proofs client-side. The Solana programs verify and store attestations using PDAs — replay protection comes from the nullifier-seeded PDA (can't init twice).

---

## License

MIT
