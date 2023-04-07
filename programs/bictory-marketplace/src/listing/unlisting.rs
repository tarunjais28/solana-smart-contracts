use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{self, Mint, Token, TokenAccount, SetAuthority};
use spl_token::instruction::AuthorityType;

use crate::{constant::*, states::*, utils::*, error::*};

/// Unlisting NFT.
pub fn unlisting(ctx: Context<Unlisting>) -> Result<()> {
    // Check expiration date
    let now = Clock::get()?.unix_timestamp as u64;
    require!(
        ctx.accounts.listing_account.expiry == 0 ||
        ctx.accounts.listing_account.expiry < now,
        MarketplaceError::InvalidExpiry,
    );

    // Set nft's authority to owner
    let cpi_account = SetAuthority {
        current_authority: ctx.accounts.auction_house_treasury.to_account_info().clone(),
        account_or_mint: ctx.accounts.nft_account.to_account_info().clone(),
    };

    let ah_key = ctx.accounts.auction_house.key();
    let signer_seeds = &[
        PREFIX,
        ah_key.as_ref(),
        TREASURY,
        &[bump(&[
            PREFIX,
            ah_key.as_ref(),
            TREASURY,
        ], ctx.program_id)],
    ];
    let signer = &[&signer_seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info().clone(),
        cpi_account,
        signer
    );

    token::set_authority(
        cpi_ctx,
        AuthorityType::AccountOwner,
        Some(ctx.accounts.seller.key()),
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct Unlisting<'info> {
    /// Seller account.
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Treasury mint account, either native SOL mint or a SPL token mint.
    pub treasury_mint: Account<'info, Mint>,

    /// Authority key for the Auction House.
    /// CHECK: Validated as a auction house signer.
    pub authority: UncheckedAccount<'info>,

    /// Auction House treasury PDA account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(seeds=[PREFIX, auction_house.key().as_ref(), TREASURY], bump)]
    pub auction_house_treasury: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account( 
        seeds=[PREFIX, auction_house.creator.as_ref(), treasury_mint.key().as_ref()], 
        bump, 
        has_one=authority, 
        has_one=treasury_mint, 
        has_one=auction_house_treasury
    )]
    pub auction_house: Account<'info, AuctionHouse>,
    
    /// NFT mint account
    /// CHECK: Validated as a nft account.
    pub nft_mint: UncheckedAccount<'info>,
    
    /// NFT token account
    #[account(mut,
        constraint = nft_account.mint == nft_mint.key()
    )]
    pub nft_account: Box<Account<'info, TokenAccount>>,

    /// Listing PDA account
    #[account(
        mut,
        seeds=[
            PREFIX,
            nft_mint.key().as_ref(),
            LISTING
        ],
        bump, 
        close=seller
    )]
    pub listing_account: Account<'info, ListingAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}