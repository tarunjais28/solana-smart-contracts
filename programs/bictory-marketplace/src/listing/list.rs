use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::token::{self, Mint, Token, TokenAccount, SetAuthority};
use spl_token::instruction::AuthorityType;

use crate::{constant::*, states::*, utils::*, error::*};

/// Listing NFT with price & expiry date.
pub fn list(ctx: Context<Listing>, price: u64, seller_expiry: Option<u64>) -> Result<()> {

    // Check expiry date
    let mut _expiry = 0;
    if let Some(expiry) = seller_expiry {
        let now = Clock::get()?.unix_timestamp as u64;
        require!(expiry >= now, MarketplaceError::InvalidExpiry);

        _expiry = expiry;
    }

    // Check NFT balance
    require!(
        ctx.accounts.nft_account.amount > 0,
        MarketplaceError::InvalidAmount,
    );

    // If first time to listing
    if is_zero_account(&ctx.accounts.listing_account.to_account_info()) {
        // Set nft's authority to treasury account
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(ctx.accounts.auction_house_treasury.key()),
        )?;
        
        // Fill listing account
        ctx.accounts.listing_account.owner = ctx.accounts.seller.key();
        ctx.accounts.listing_account.nft_mint = ctx.accounts.nft_mint.key();
    }

    // Update price and expiry date only
    ctx.accounts.listing_account.price = price;
    ctx.accounts.listing_account.expiry = _expiry;

    // Log listing detail
    msg!("{{\"price\": \"{}\", \"seller_expiry\": {}}}", price, _expiry);

    Ok(())
}

#[derive(Accounts)]
pub struct Listing<'info> {
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
        init_if_needed,
        seeds=[
            PREFIX,
            nft_mint.key().as_ref(),
            LISTING
        ],
        bump, 
        space=8 + std::mem::size_of::<ListingAccount>(),
        payer=seller
    )]
    pub listing_account: Account<'info, ListingAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
impl<'info> Listing<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_account = SetAuthority {
            current_authority: self.seller.to_account_info().clone(),
            account_or_mint: self.nft_account.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_account)
    }
}
