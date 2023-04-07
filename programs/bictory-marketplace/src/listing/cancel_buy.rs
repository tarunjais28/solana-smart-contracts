use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token};

use crate::{constant::*, states::*, error::*};

/// Cancel offer.
pub fn cancel_buy(ctx: Context<CancelBuy>) -> Result<()> {
    // Check expiration date
    let now = Clock::get()?.unix_timestamp as u64;
    require!(
        ctx.accounts.offer_account.expiry == 0 ||
        ctx.accounts.offer_account.expiry < now,
        MarketplaceError::InvalidExpiry,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CancelBuy<'info> {
    /// Buyer account.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Treasury mint account, either native SOL mint or a SPL token mint.
    pub treasury_mint: Account<'info, Mint>,

    /// Authority key for the Auction House.
    /// CHECK: Validated as a auction house signer.
    pub authority: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account( 
        seeds=[PREFIX, auction_house.creator.as_ref(), treasury_mint.key().as_ref()], 
        bump, 
        has_one=authority, 
        has_one=treasury_mint
    )]
    pub auction_house: Account<'info, AuctionHouse>,
    
    /// NFT mint account
    /// CHECK: Validated as a nft account.
    pub nft_mint: UncheckedAccount<'info>,

    /// Offer PDA account
    #[account(
        mut,
        seeds=[
            PREFIX,
            nft_mint.key().as_ref(),
            buyer.key().as_ref(),
            OFFER
        ],
        bump, 
        close = buyer
    )]
    pub offer_account: Account<'info, OfferAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
