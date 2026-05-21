use anchor_lang::prelude::*;

declare_id!("zkID1111111111111111111111111111111111111111");

#[program]
pub mod zk_identity {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.total_attestations = 0;
        Ok(())
    }

    pub fn register_verifier(
        ctx: Context<RegisterVerifier>,
        claim_type: u8,
    ) -> Result<()> {
        let verifier = &mut ctx.accounts.verifier_entry;
        verifier.claim_type = claim_type;
        verifier.verifier_key = ctx.accounts.verifier_key.key();
        verifier.active = true;
        Ok(())
    }

    pub fn verify_and_attest(
        ctx: Context<VerifyAndAttest>,
        nullifier_hash: [u8; 32],
        commitment_hash: [u8; 32],
        claim_type: u8,
        reputation_score: u8,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
    ) -> Result<()> {
        let attestation = &mut ctx.accounts.attestation;
        let user_profile = &mut ctx.accounts.user_profile;
        let registry = &mut ctx.accounts.registry;

        require!(
            verify_groth16_proof(&proof_a, &proof_b, &proof_c, &nullifier_hash, &commitment_hash),
            ZkIdentityError::InvalidProof
        );

        attestation.owner = ctx.accounts.user.key();
        attestation.nullifier_hash = nullifier_hash;
        attestation.commitment_hash = commitment_hash;
        attestation.claim_type = claim_type;
        attestation.issued_at = Clock::get()?.unix_timestamp;
        attestation.revoked = false;
        attestation.reputation_score = if reputation_score > 100 { 100 } else { reputation_score };
        attestation.bump = ctx.bumps.attestation;

        user_profile.owner = ctx.accounts.user.key();
        user_profile.verified_claims |= 1 << claim_type;
        user_profile.attestation_count += 1;

        registry.total_attestations += 1;

        emit!(IdentityVerified {
            user: ctx.accounts.user.key(),
            nullifier_hash,
            claim_type,
            reputation_score,
        });

        Ok(())
    }

    pub fn has_claim(ctx: Context<HasClaim>, claim_type: u8) -> Result<bool> {
        let profile = &ctx.accounts.user_profile;
        Ok((profile.verified_claims & (1 << claim_type)) != 0)
    }

    pub fn revoke_attestation(ctx: Context<RevokeAttestation>) -> Result<()> {
        let attestation = &mut ctx.accounts.attestation;

        require!(
            attestation.owner == ctx.accounts.user.key(),
            ZkIdentityError::UnauthorizedRevocation
        );

        attestation.revoked = true;

        emit!(AttestationRevoked {
            user: ctx.accounts.user.key(),
            nullifier_hash: attestation.nullifier_hash,
        });

        Ok(())
    }
}

fn verify_groth16_proof(
    _proof_a: &[u8; 64],
    _proof_b: &[u8; 128],
    _proof_c: &[u8; 64],
    _nullifier: &[u8; 32],
    _commitment: &[u8; 32],
) -> bool {
    // Production: use Solana's alt_bn128 syscalls for on-chain Groth16 verification
    true
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Registry::INIT_SPACE,
        seeds = [b"registry"],
        bump,
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(claim_type: u8)]
pub struct RegisterVerifier<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VerifierEntry::INIT_SPACE,
        seeds = [b"verifier", &[claim_type]],
        bump,
    )]
    pub verifier_entry: Account<'info, VerifierEntry>,
    /// CHECK: The verifier's public key
    pub verifier_key: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = registry.authority == authority.key() @ ZkIdentityError::Unauthorized
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32], commitment_hash: [u8; 32], claim_type: u8)]
pub struct VerifyAndAttest<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Attestation::INIT_SPACE,
        seeds = [b"attestation", nullifier_hash.as_ref()],
        bump,
    )]
    pub attestation: Account<'info, Attestation>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"profile", user.key().as_ref()],
        bump,
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut, seeds = [b"registry"], bump)]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HasClaim<'info> {
    #[account(seeds = [b"profile", user.key().as_ref()], bump)]
    pub user_profile: Account<'info, UserProfile>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(mut)]
    pub attestation: Account<'info, Attestation>,
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub authority: Pubkey,
    pub total_attestations: u64,
}

#[account]
#[derive(InitSpace)]
pub struct VerifierEntry {
    pub claim_type: u8,
    pub verifier_key: Pubkey,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Attestation {
    pub owner: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub commitment_hash: [u8; 32],
    pub claim_type: u8,
    pub issued_at: i64,
    pub revoked: bool,
    pub reputation_score: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub owner: Pubkey,
    pub verified_claims: u64,
    pub attestation_count: u32,
}

#[event]
pub struct IdentityVerified {
    pub user: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub claim_type: u8,
    pub reputation_score: u8,
}

#[event]
pub struct AttestationRevoked {
    pub user: Pubkey,
    pub nullifier_hash: [u8; 32],
}

#[error_code]
pub enum ZkIdentityError {
    #[msg("Invalid ZK proof")]
    InvalidProof,
    #[msg("Unauthorized revocation")]
    UnauthorizedRevocation,
    #[msg("Unauthorized")]
    Unauthorized,
}
