# ============================================================================
# ZK-Identity Solana — Noir + Sunspot + Groth16
# ============================================================================

# Quick start
install-all:
    npm install

test-all: test-age test-unique

verify-all: verify-age verify-unique

# ── Age Verifier ─────────────────────────────────────────────────────────────

compile-age:
    cd circuits/age_verifier && nargo compile

test-age:
    cd circuits/age_verifier && nargo test

execute-age:
    cd circuits/age_verifier && nargo execute

# Sunspot: convert ACIR → constraint system → proving key
setup-age: compile-age
    cd circuits/age_verifier && sunspot compile target/age_verifier.json
    cd circuits/age_verifier && sunspot setup target/age_verifier.json target/age_verifier.ccs

# Sunspot: generate Groth16 proof
prove-age: execute-age
    cd circuits/age_verifier && sunspot prove target/age_verifier.json target/age_verifier.gz target/age_verifier.ccs target/age_verifier.pk

# Build and deploy verifier program
deploy-age:
    cd circuits/age_verifier && sunspot deploy target/age_verifier.vk
    solana program deploy circuits/age_verifier/target/verifier.so --keypair circuits/age_verifier/keypair/deployer.json --url devnet

# Verify proof on-chain
verify-age: prove-age
    npx ts-node circuits/age_verifier/client/verify.ts

# Full pipeline
full-age: setup-age prove-age verify-age

# ── Unique Human ─────────────────────────────────────────────────────────────

compile-unique:
    cd circuits/unique_human && nargo compile

test-unique:
    cd circuits/unique_human && nargo test

execute-unique:
    cd circuits/unique_human && nargo execute

setup-unique: compile-unique
    cd circuits/unique_human && sunspot compile target/unique_human.json
    cd circuits/unique_human && sunspot setup target/unique_human.json target/unique_human.ccs

prove-unique: execute-unique
    cd circuits/unique_human && sunspot prove target/unique_human.json target/unique_human.gz target/unique_human.ccs target/unique_human.pk

deploy-unique:
    cd circuits/unique_human && sunspot deploy target/unique_human.vk
    solana program deploy circuits/unique_human/target/verifier.so --keypair circuits/unique_human/keypair/deployer.json --url devnet

verify-unique: prove-unique
    npx ts-node circuits/unique_human/client/verify.ts

full-unique: setup-unique prove-unique verify-unique

# ── Wallet Setup ─────────────────────────────────────────────────────────────

setup-wallets:
    solana-keygen new --outfile circuits/age_verifier/keypair/deployer.json --no-bip39-passphrase -s
    solana-keygen new --outfile circuits/unique_human/keypair/deployer.json --no-bip39-passphrase -s

fund-wallets:
    solana airdrop 2 $(solana address -k circuits/age_verifier/keypair/deployer.json) --url devnet
    solana airdrop 2 $(solana address -k circuits/unique_human/keypair/deployer.json) --url devnet

# ── Utility ──────────────────────────────────────────────────────────────────

version:
    @echo "nargo:" && nargo --version
    @echo "sunspot:" && sunspot --version
    @echo "solana:" && solana --version
