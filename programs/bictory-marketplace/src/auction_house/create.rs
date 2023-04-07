use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::{constant::*, states::*, utils::*, error::*};

/// Create a new Auction House instance.
pub fn create_auction_house(ctx: Context<CreateAuctionHouse>, seller_fee_basis_points: u16, discount_collection: Pubkey, discount_basis_points: u16) -> Result<()> {
    let treasury_mint = &ctx.accounts.treasury_mint;
    let payer = &ctx.accounts.payer;
    let authority = &ctx.accounts.authority;
    let auction_house = &mut ctx.accounts.auction_house;
    let auction_house_treasury = &ctx.accounts.auction_house_treasury;
    let treasury_withdrawal_destination_owner = &ctx.accounts.treasury_withdrawal_destination_owner;
    let treasury_withdrawal_destination = &ctx.accounts.treasury_withdrawal_destination;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let ata_program = &ctx.accounts.ata_program;
    let rent = &ctx.accounts.rent;

    require!(seller_fee_basis_points <= 10000, MarketplaceError::InvalidAmount);
    require!(discount_basis_points <= seller_fee_basis_points, MarketplaceError::InvalidAmount);

    auction_house.creator = authority.key();
    auction_house.authority = authority.key();
    auction_house.treasury_mint = treasury_mint.key();
    auction_house.auction_house_treasury = auction_house_treasury.key();
    auction_house.treasury_withdrawal_destination = treasury_withdrawal_destination.key();
    auction_house.seller_fee_basis_points = seller_fee_basis_points;
    auction_house.discount_collection = discount_collection;
    auction_house.discount_basis_points = discount_basis_points;

    let is_native = treasury_mint.key() == spl_token::native_mint::id();

    let ah_key = auction_house.key();

    let auction_house_treasury_seeds = [PREFIX, ah_key.as_ref(), TREASURY, 
    &[bump(&[PREFIX, ah_key.as_ref(), TREASURY], ctx.program_id)]];

    create_program_token_account_if_not_present(
        auction_house_treasury,
        system_program,
        payer,
        token_program,
        treasury_mint,
        &auction_house.to_account_info(),
        rent,
        &auction_house_treasury_seeds,
        &[],
        is_native,
    )?;

    if !is_native {
        if treasury_withdrawal_destination.data_is_empty() {
            make_ata(
                treasury_withdrawal_destination.to_account_info(),
                treasury_withdrawal_destination_owner.to_account_info(),
                treasury_mint.to_account_info(),
                payer.to_account_info(),
                ata_program.to_account_info(),
                token_program.to_account_info(),
                system_program.to_account_info(),
                rent.to_account_info(),
                &[],
            )?;
        }

        assert_is_ata(
            &treasury_withdrawal_destination.to_account_info(),
            &treasury_withdrawal_destination_owner.key(),
            &treasury_mint.key(),
        )?;
    } else {
        assert_keys_equal(
            treasury_withdrawal_destination.key(),
            treasury_withdrawal_destination_owner.key(),
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct CreateAuctionHouse<'info> {
    /// Treasury mint account, either native SOL mint or a SPL token mint.
    pub treasury_mint: Account<'info, Mint>,

    /// Key paying SOL fees for setting up the Auction House.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: User can use whatever they want for intialization.
    // Authority key for the Auction House.
    pub authority: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// SOL or SPL token account to receive Auction House fees. If treasury mint is native this will be the same as the `treasury_withdrawal_destination_owner`.
    #[account(mut)]
    pub treasury_withdrawal_destination: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// Owner of the `treasury_withdrawal_destination` account or the same address if the `treasury_mint` is native.
    pub treasury_withdrawal_destination_owner: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account(init, 
        seeds=[PREFIX, authority.key().as_ref(),
         treasury_mint.key().as_ref()], bump, 
        space=8 + std::mem::size_of::<AuctionHouse>(),
        payer=payer)]
    pub auction_house: Account<'info, AuctionHouse>,

    /// Auction House instance treasury PDA account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(mut, seeds=[PREFIX, auction_house.key().as_ref(), TREASURY], bump)]
    pub auction_house_treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub ata_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
