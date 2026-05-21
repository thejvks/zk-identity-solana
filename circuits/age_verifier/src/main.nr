// ============================================================================
// Age Verifier Circuit
// ============================================================================
// Proves that a user's age >= minAge WITHOUT revealing their birth year.
//
// Private inputs: birthYear, salt
// Public inputs:  minAge, currentYear, nullifierHash, commitmentHash
//
// The circuit verifies:
//   1. commitmentHash == hash(birthYear, salt)
//   2. nullifierHash  == hash(birthYear, salt, 1)
//   3. currentYear - birthYear >= minAge
//
// Nothing on-chain reveals birthYear. Ever.
// ============================================================================

use dep::poseidon::poseidon::bn254::hash_2 as poseidon2;
use dep::poseidon::poseidon::bn254::hash_3 as poseidon3;

fn main(
    // Public inputs
    nullifier_hash: pub Field,
    commitment_hash: pub Field,
    min_age: pub u64,
    current_year: pub u64,
    // Private inputs (never revealed)
    birth_year: u64,
    salt: Field,
) {
    // Step 1: Verify the commitment
    // Prover must know the actual birthYear behind the commitment
    let computed_commitment = poseidon2([birth_year as Field, salt]);
    assert(computed_commitment == commitment_hash, "Commitment mismatch");

    // Step 2: Verify the nullifier
    // Nullifier = hash(birthYear, salt, claimType=1)
    // Prevents the same credential from being used twice
    let computed_nullifier = poseidon3([birth_year as Field, salt, 1]);
    assert(computed_nullifier == nullifier_hash, "Nullifier mismatch");

    // Step 3: Verify age constraint
    // age = currentYear - birthYear >= minAge
    assert(current_year >= birth_year, "Birth year cannot be in the future");
    let age = current_year - birth_year;
    assert(age >= min_age, "Age requirement not met");
}

// ============================================================================
// Tests
// ============================================================================

#[test]
fn test_valid_age_proof() {
    let birth_year: u64 = 1995;
    let salt: Field = 12345;
    let min_age: u64 = 18;
    let current_year: u64 = 2025;

    let commitment = poseidon2([birth_year as Field, salt]);
    let nullifier = poseidon3([birth_year as Field, salt, 1]);

    main(nullifier, commitment, min_age, current_year, birth_year, salt);
}

#[test]
fn test_exactly_min_age() {
    let birth_year: u64 = 2007;
    let salt: Field = 99999;
    let min_age: u64 = 18;
    let current_year: u64 = 2025;

    let commitment = poseidon2([birth_year as Field, salt]);
    let nullifier = poseidon3([birth_year as Field, salt, 1]);

    main(nullifier, commitment, min_age, current_year, birth_year, salt);
}

#[test(should_fail_with = "Age requirement not met")]
fn test_underage_fails() {
    let birth_year: u64 = 2010;
    let salt: Field = 42;
    let min_age: u64 = 18;
    let current_year: u64 = 2025;

    let commitment = poseidon2([birth_year as Field, salt]);
    let nullifier = poseidon3([birth_year as Field, salt, 1]);

    main(nullifier, commitment, min_age, current_year, birth_year, salt);
}

#[test(should_fail_with = "Commitment mismatch")]
fn test_wrong_birth_year_fails() {
    let real_birth_year: u64 = 1995;
    let fake_birth_year: u64 = 1990;
    let salt: Field = 12345;

    let commitment = poseidon2([real_birth_year as Field, salt]);
    let nullifier = poseidon3([real_birth_year as Field, salt, 1]);

    // Trying to prove with a fake birth year should fail
    main(nullifier, commitment, 18, 2025, fake_birth_year, salt);
}

#[test]
fn test_commitment_deterministic() {
    let h1 = poseidon2([1995, 12345]);
    let h2 = poseidon2([1995, 12345]);
    assert(h1 == h2);
}

#[test]
fn test_different_salt_different_commitment() {
    let h1 = poseidon2([1995, 11111]);
    let h2 = poseidon2([1995, 22222]);
    assert(h1 != h2);
}

#[test]
fn test_nullifier_scoped_to_claim_type() {
    // claimType=1 (age) and claimType=2 (unique) produce different nullifiers
    let n1 = poseidon3([1995, 12345, 1]);
    let n2 = poseidon3([1995, 12345, 2]);
    assert(n1 != n2, "Nullifiers must differ across claim types");
}
