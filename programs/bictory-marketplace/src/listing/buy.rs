use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{Mint, Token};

use crate::{constant::*, states::*, utils::*, error::*};

/// Offer buy NFT with price & expiry date.
pub fn buy(ctx: Context<Buy>, price: u64, buyer_expiry: Option<u64>) -> Result<()> {

    // Check expiry date
    let mut _expiry = 0;
    if let Some(expiry) = buyer_expiry {
        let now = Clock::get()?.unix_timestamp as u64;
        require!(expiry >= now, MarketplaceError::InvalidExpiry);

        _expiry = expiry;
    }

    // If first time to offer
    if is_zero_account(&ctx.accounts.offer_account.to_account_info()) {
        
        // Fill offer account
        ctx.accounts.offer_account.buyer = ctx.accounts.buyer.key();
        ctx.accounts.offer_account.nft_mint = ctx.accounts.nft_mint.key();
    }

    // Update price and expiry date
    ctx.accounts.offer_account.price = price;
    ctx.accounts.offer_account.expiry = _expiry;

    // Log offer detail
    msg!("{{\"price\": \"{}\", \"buyer_expiry\": {}}}", price, _expiry);

    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info> {
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
        has_one=treasury_mint,
    )]
    pub auction_house: Account<'info, AuctionHouse>,
    
    /// NFT mint account
    /// CHECK: Validated as a nft account.
    pub nft_mint: UncheckedAccount<'info>,

    /// Offer PDA account
    #[account(
        init_if_needed,
        seeds=[
            PREFIX,
            nft_mint.key().as_ref(),
            buyer.key().as_ref(),
            OFFER
        ],
        bump, 
        space=8 + std::mem::size_of::<OfferAccount>(),
        payer=buyer,
    )]
    pub offer_account: Account<'info, OfferAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
