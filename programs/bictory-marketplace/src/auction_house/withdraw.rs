use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_spl::token::{Mint, Token};

use crate::{constant::*, states::*, utils::*};

/// Withdraw `amount` from the Auction House Treasury Account to a provided destination account.
pub fn withdraw_from_treasury(ctx: Context<WithdrawFromTreasury>, amount: u64) -> Result<()> {
    let treasury_mint = &ctx.accounts.treasury_mint;
    let treasury_withdrawal_destination = &ctx.accounts.treasury_withdrawal_destination;
    let auction_house_treasury = &ctx.accounts.auction_house_treasury;
    let auction_house = &ctx.accounts.auction_house;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;

    let is_native = treasury_mint.key() == spl_token::native_mint::id();
    let auction_house_seeds = [
        PREFIX,
        auction_house.creator.as_ref(),
        auction_house.treasury_mint.as_ref(),
        &[bump(
            &[
                PREFIX,
                auction_house.creator.as_ref(),
                auction_house.treasury_mint.as_ref(),
            ],
            ctx.program_id,
        )],
    ];

    let ah_key = auction_house.key();
    let auction_house_treasury_seeds = [
        PREFIX,
        ah_key.as_ref(),
        TREASURY,
        &[bump(&[PREFIX, ah_key.as_ref(), TREASURY], ctx.program_id)],
    ];
    if !is_native {
        invoke_signed(
            &spl_token::instruction::transfer(
                token_program.key,
                &auction_house_treasury.key(),
                &treasury_withdrawal_destination.key(),
                &auction_house.key(),
                &[],
                amount,
            )?,
            &[
                auction_house_treasury.to_account_info(),
                treasury_withdrawal_destination.to_account_info(),
                token_program.to_account_info(),
                auction_house.to_account_info(),
            ],
            &[&auction_house_seeds],
        )?;
    } else {
        invoke_signed(
            &system_instruction::transfer(
                &auction_house_treasury.key(),
                &treasury_withdrawal_destination.key(),
                amount,
            ),
            &[
                auction_house_treasury.to_account_info(),
                treasury_withdrawal_destination.to_account_info(),
                system_program.to_account_info(),
            ],
            &[&auction_house_treasury_seeds],
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFromTreasury<'info> {
    /// Treasury mint account, either native SOL mint or a SPL token mint.
    pub treasury_mint: Account<'info, Mint>,

    /// Authority key for the Auction House.
    pub authority: Signer<'info>,

    /// SOL or SPL token account to receive Auction House fees. If treasury mint is native this will be the same as the `treasury_withdrawal_destination_owner`.
    /// CHECK: User can withdraw wherever they want as long as they sign as authority.
    #[account(mut)]
    pub treasury_withdrawal_destination: UncheckedAccount<'info>,

    /// Auction House treasury PDA account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(mut, seeds=[PREFIX, auction_house.key().as_ref(), TREASURY], bump)]
    pub auction_house_treasury: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account(mut, 
        seeds=[PREFIX, auction_house.creator.as_ref(), treasury_mint.key().as_ref()], 
        bump, 
        has_one=authority, 
        has_one=treasury_mint, 
        has_one=treasury_withdrawal_destination, 
        has_one=auction_house_treasury
    )]
    pub auction_house: Account<'info, AuctionHouse>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
