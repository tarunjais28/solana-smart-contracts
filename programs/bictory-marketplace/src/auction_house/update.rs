use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::{constant::*, error::*, states::*, utils::*};

/// Update Auction House values such as seller fee basis points, update authority, treasury account, etc.
pub fn update_auction_house(
    ctx: Context<UpdateAuctionHouse>,
    seller_fee_basis_points: Option<u16>,
    discount_collection: Option<Pubkey>,
    discount_basis_points: Option<u16>,
) -> Result<()> {
    let treasury_mint = &ctx.accounts.treasury_mint;
    let payer = &ctx.accounts.payer;
    let new_authority = &ctx.accounts.new_authority;
    let auction_house = &mut ctx.accounts.auction_house;
    let treasury_withdrawal_destination_owner = &ctx.accounts.treasury_withdrawal_destination_owner;
    let treasury_withdrawal_destination = &ctx.accounts.treasury_withdrawal_destination;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;
    let ata_program = &ctx.accounts.ata_program;
    let rent = &ctx.accounts.rent;
    let is_native = treasury_mint.key() == spl_token::native_mint::id();

    if let Some(sfbp) = seller_fee_basis_points {
        require!(sfbp <= 10000, MarketplaceError::InvalidAmount);

        auction_house.seller_fee_basis_points = sfbp;
    }
    if let Some(discount_col) = discount_collection {
        auction_house.discount_collection = discount_col;
    }
    if let Some(discount_points) = discount_basis_points {
        require!(discount_points <= auction_house.seller_fee_basis_points, MarketplaceError::InvalidAmount);

        auction_house.discount_basis_points = discount_points;
    }

    auction_house.authority = new_authority.key();
    auction_house.treasury_withdrawal_destination = treasury_withdrawal_destination.key();

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
pub struct UpdateAuctionHouse<'info> {
    /// Treasury mint account, either native SOL mint or a SPL token mint.
    pub treasury_mint: Account<'info, Mint>,

    /// Key paying SOL fees for setting up the Auction House.
    pub payer: Signer<'info>,

    /// Authority key for the Auction House.
    pub authority: Signer<'info>,

    /// CHECK: User can use whatever they want for updating this.
    /// New authority key for the Auction House.
    pub new_authority: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for updating this.
    /// SOL or SPL token account to receive Auction House fees. If treasury mint is native this will be the same as the `treasury_withdrawal_destination_owner`.
    #[account(mut)]
    pub treasury_withdrawal_destination: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for updating this.
    /// Owner of the `treasury_withdrawal_destination` account or the same address if the `treasury_mint` is native.
    pub treasury_withdrawal_destination_owner: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account(mut, seeds=[PREFIX, auction_house.creator.as_ref(), treasury_mint.key().as_ref()], bump, has_one=authority, has_one=treasury_mint)]
    pub auction_house: Account<'info, AuctionHouse>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub ata_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
