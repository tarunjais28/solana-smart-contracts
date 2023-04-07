use anchor_lang::prelude::*;

mod auction_house;
mod deposit;
mod execute_sale;
mod listing;

/// constant
mod constant;
/// error
mod error;
/// states
mod states;
/// utils
mod utils;

use crate::{auction_house::*, deposit::*, execute_sale::*, listing::*};

declare_id!("GG2v349mCx2DUL2Pu3aFtKgjxdNjxYYZjUXVhLSbFt8Q");

#[program]
pub mod marketplace {
    use super::*;
    // admin
    pub fn create_auction_house(
        ctx: Context<CreateAuctionHouse>,
        seller_fee_basis_points: u16,
        discount_collection: Pubkey,
        discount_basis_points: u16,
    ) -> Result<()> {
        auction_house::create_auction_house(
            ctx,
            seller_fee_basis_points,
            discount_collection,
            discount_basis_points,
        )
    }
    pub fn update_auction_house(
        ctx: Context<UpdateAuctionHouse>,
        seller_fee_basis_points: Option<u16>,
        discount_collection: Option<Pubkey>,
        discount_basis_points: Option<u16>,
    ) -> Result<()> {
        auction_house::update_auction_house(
            ctx,
            seller_fee_basis_points,
            discount_collection,
            discount_basis_points,
        )
    }
    pub fn withdraw_from_treasury(ctx: Context<WithdrawFromTreasury>, amount: u64) -> Result<()> {
        auction_house::withdraw_from_treasury(ctx, amount)
    }

    // user
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handle(ctx, amount)
    }

    // listing
    pub fn list(ctx: Context<Listing>, price: u64, seller_expiry: Option<u64>) -> Result<()> {
        listing::list(ctx, price, seller_expiry)
    }
    pub fn unlisting(ctx: Context<Unlisting>) -> Result<()> {
        listing::unlisting(ctx)
    }
    pub fn buy(ctx: Context<Buy>, price: u64, buyer_expiry: Option<u64>) -> Result<()> {
        listing::buy(ctx, price, buyer_expiry)
    }
    pub fn cancel_buy(ctx: Context<CancelBuy>) -> Result<()> {
        listing::cancel_buy(ctx)
    }

    // sale
    pub fn execute_sale<'info>(ctx: Context<'_, '_, '_, 'info, ExecuteSale<'info>>) -> Result<()> {
        execute_sale::handle(ctx)
    }
}
