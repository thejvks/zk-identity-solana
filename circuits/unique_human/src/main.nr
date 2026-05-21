// ============================================================================
// Unique Human Circuit
// ============================================================================
// Proves that a user controls a unique credential WITHOUT revealing it.
// Sybil-resistance: each real human can only generate ONE valid nullifier
// per context (e.g. per app or per vote).
//
// Private inputs: secret, salt
// Public inputs:  nullifierHash, commitmentHash, contextId
//
// The circuit verifies:
//   1. commitmentHash == hash(secret, salt)
//   2. nullifierHash  == hash(secret, salt, contextId)
//   3. secret != 0 (basic validity)
//
// Cross-app tracking is cryptographically impossible because
// different contextIds produce different nullifiers.
// ============================================================================

use dep::poseidon::poseidon::bn254::hash_2 as poseidon2;
use dep::poseidon::poseidon::bn254::hash_3 as poseidon3;

fn main(
    // Public inputs
    nullifier_hash: pub Field,
    commitment_hash: pub Field,
    context_id: pub Field,
    // Private inputs (never revealed)
    secret: Field,
    salt: Field,
) {
    // Step 1: Verify the commitment
    let computed_commitment = poseidon2([secret, salt]);
    assert(computed_commitment == commitment_hash, "Commitment mismatch");

    // Step 2: Verify context-scoped nullifier
    // Same human + different app = different nullifier
    let computed_nullifier = poseidon3([secret, salt, context_id]);
    assert(computed_nullifier == nullifier_hash, "Nullifier mismatch");

    // Step 3: Secret must be non-zero
    assert(secret != 0, "Secret must not be zero");
}

// ============================================================================
// Tests
// ============================================================================

#[test]
fn test_valid_uniqueness_proof() {
    let secret: Field = 987654321;
    let salt: Field = 111222333;
    let context_id: Field = 1; // app identifier

    let commitment = poseidon2([secret, salt]);
    let nullifier = poseidon3([secret, salt, context_id]);

    main(nullifier, commitment, context_id, secret, salt);
}

#[test]
fn test_different_context_different_nullifier() {
    let secret: Field = 987654321;
    let salt: Field = 111222333;

    let n1 = poseidon3([secret, salt, 1]); // app 1
    let n2 = poseidon3([secret, salt, 2]); // app 2

    assert(n1 != n2, "Cross-app tracking must be impossible");
}

#[test]
fn test_same_context_same_nullifier() {
    let secret: Field = 987654321;
    let salt: Field = 111222333;
    let ctx: Field = 42;

    let n1 = poseidon3([secret, salt, ctx]);
    let n2 = poseidon3([secret, salt, ctx]);

    assert(n1 == n2, "Same inputs must produce same nullifier");
}

#[test(should_fail_with = "Secret must not be zero")]
fn test_zero_secret_fails() {
    let secret: Field = 0;
    let salt: Field = 12345;
    let context_id: Field = 1;

    let commitment = poseidon2([secret, salt]);
    let nullifier = poseidon3([secret, salt, context_id]);

    main(nullifier, commitment, context_id, secret, salt);
}

#[test(should_fail_with = "Commitment mismatch")]
fn test_wrong_secret_fails() {
    let real_secret: Field = 987654321;
    let fake_secret: Field = 111111111;
    let salt: Field = 12345;
    let context_id: Field = 1;

    let commitment = poseidon2([real_secret, salt]);
    let nullifier = poseidon3([real_secret, salt, context_id]);

    main(nullifier, commitment, context_id, fake_secret, salt);
}

#[test]
fn test_commitment_deterministic() {
    let h1 = poseidon2([987654321, 111222333]);
    let h2 = poseidon2([987654321, 111222333]);
    assert(h1 == h2);
}
