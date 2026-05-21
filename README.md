# ZK-Identity — Solana

> **Prove who you are. Reveal nothing.**

Zero-Knowledge identity verification on Solana using **Noir circuits**, **Groth16 proofs via Sunspot**, and on-chain verification — following the [Solana Foundation's recommended pattern](https://github.com/solana-foundation/noir-examples).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Noir](https://img.shields.io/badge/Noir-1.0.0--beta.13-purple)](circuits/)
[![Solana](https://img.shields.io/badge/Solana-2.1-green)](https://solana.com)

---

## Circuits

| Circuit | Description | Private Inputs | Public Inputs |
|---|---|---|---|
| **age_verifier** | Prove `age >= N` without revealing birthdate | birthYear, salt | minAge, currentYear, nullifierHash, commitmentHash |
| **unique_human** | Sybil-resistance — one proof per person per app | secret, salt | contextId, nullifierHash, commitmentHash |

---

## Pipeline

```
Noir Circuit → nargo compile → nargo execute → Sunspot prove → Solana verify
```

| Stage | Tool | What happens |
|---|---|---|
| Write circuit | Noir | Define constraints in `src/main.nr` |
| Unit test | `nargo test` | Run local circuit tests |
| Compile | `nargo compile` | Convert to ACIR bytecode |
| Generate witness | `nargo execute` | Produce witness from Prover.toml inputs |
| Setup keys | `sunspot setup` | Generate proving key + verifying key |
| Generate proof | `sunspot prove` | Create Groth16 proof |
| Build verifier | `sunspot deploy` | Create Solana verifier program (.so) |
| Deploy | `solana program deploy` | Deploy verifier to devnet/mainnet |
| Verify on-chain | Submit tx | Send `proof_bytes + public_witness_bytes` |

---

## Prerequisites

- [Nargo](https://noir-lang.org/docs/) 1.0.0-beta.13
- [Sunspot](https://github.com/reilabs/sunspot) (requires Go 1.24+)
- [Solana CLI](https://docs.solanalabs.com/cli/install) 2.1+
- [Node.js](https://nodejs.org/) 18+
- [just](https://github.com/casey/just) (optional, for command runner)

```bash
# Install Nargo
noirup -v 1.0.0-beta.13

# Install Sunspot (requires Go)
git clone https://github.com/reilabs/sunspot && cd sunspot && go build
```

---

## Quick Start

```bash
git clone https://github.com/thejvks/zk-identity-solana
cd zk-identity-solana
npm install
```

### Run Circuit Tests (no Solana needed)

```bash
just test-all
# or
npm test
```

### Full On-Chain Pipeline

```bash
# 1. Setup wallets and fund on devnet
just setup-wallets
just fund-wallets

# 2. Compile, setup keys, prove, deploy, verify
just full-age
just full-unique
```

---

## Project Structure

```
├── circuits/
│   ├── age_verifier/
│   │   ├── src/main.nr          # Age proof circuit (Noir)
│   │   ├── Nargo.toml           # Circuit config
│   │   ├── Prover.toml          # Input values
│   │   └── client/verify.ts     # On-chain verification client
│   └── unique_human/
│       ├── src/main.nr          # Uniqueness proof circuit (Noir)
│       ├── Nargo.toml
│       ├── Prover.toml
│       └── client/verify.ts
├── lib/
│   ├── proof.ts                 # Proof generation pipeline
│   └── verify.ts                # On-chain verification helpers
├── justfile                     # Command runner
└── package.json
```

---

## How It Works

### Age Verification

```
Private: birthYear=1995, salt=random
Public:  minAge=18, currentYear=2025

Circuit proves:
  1. commitmentHash == Poseidon(birthYear, salt)     → you know the birthYear
  2. nullifierHash  == Poseidon(birthYear, salt, 1)   → prevents replay
  3. currentYear - birthYear >= minAge                → you are old enough

Nothing on-chain reveals birthYear. Ever.
```

### Unique Human

```
Private: secret, salt
Public:  contextId (app identifier)

Circuit proves:
  1. commitmentHash == Poseidon(secret, salt)
  2. nullifierHash  == Poseidon(secret, salt, contextId)
  3. secret != 0

Same human + different app = different nullifier.
Cross-app tracking is cryptographically impossible.
```

---

## License

MIT
