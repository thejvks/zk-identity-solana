use anchor_lang::prelude::*;

declare_id!("repO1111111111111111111111111111111111111111");

#[program]
pub mod reputation_oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn set_oracle_status(
        ctx: Context<SetOracleStatus>,
        oracle: Pubkey,
        active: bool,
    ) -> Result<()> {
        let oracle_entry = &mut ctx.accounts.oracle_entry;
        oracle_entry.oracle = oracle;
        oracle_entry.active = active;

        emit!(OracleAuthorized { oracle, active });
        Ok(())
    }

    pub fn submit_score(
        ctx: Context<SubmitScore>,
        nullifier_hash: [u8; 32],
        score: u8,
    ) -> Result<()> {
        require!(score <= 100, ReputationError::InvalidScore);
        require!(
            ctx.accounts.oracle_entry.active,
            ReputationError::UnauthorizedOracle
        );

        let score_account = &mut ctx.accounts.score_account;
        score_account.nullifier_hash = nullifier_hash;
        score_account.score = score;
        score_account.last_updated = Clock::get()?.unix_timestamp;
        score_account.oracle = ctx.accounts.oracle.key();

        emit!(ScoreUpdated {
            nullifier_hash,
            score,
            oracle: ctx.accounts.oracle.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [b"oracle_config"],
        bump,
    )]
    pub config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(oracle: Pubkey)]
pub struct SetOracleStatus<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + OracleEntry::INIT_SPACE,
        seeds = [b"oracle", oracle.as_ref()],
        bump,
    )]
    pub oracle_entry: Account<'info, OracleEntry>,
    #[account(
        constraint = config.authority == authority.key() @ ReputationError::Unauthorized
    )]
    pub config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nullifier_hash: [u8; 32])]
pub struct SubmitScore<'info> {
    #[account(
        init_if_needed,
        payer = oracle,
        space = 8 + ScoreAccount::INIT_SPACE,
        seeds = [b"score", nullifier_hash.as_ref()],
        bump,
    )]
    pub score_account: Account<'info, ScoreAccount>,
    #[account(seeds = [b"oracle", oracle.key().as_ref()], bump)]
    pub oracle_entry: Account<'info, OracleEntry>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    pub authority: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct OracleEntry {
    pub oracle: Pubkey,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct ScoreAccount {
    pub nullifier_hash: [u8; 32],
    pub score: u8,
    pub last_updated: i64,
    pub oracle: Pubkey,
}

#[event]
pub struct ScoreUpdated {
    pub nullifier_hash: [u8; 32],
    pub score: u8,
    pub oracle: Pubkey,
}

#[event]
pub struct OracleAuthorized {
    pub oracle: Pubkey,
    pub active: bool,
}

#[error_code]
pub enum ReputationError {
    #[msg("Score must be between 0 and 100")]
    InvalidScore,
    #[msg("Oracle is not authorized")]
    UnauthorizedOracle,
    #[msg("Unauthorized")]
    Unauthorized,
}
