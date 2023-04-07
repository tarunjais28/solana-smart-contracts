use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct AuctionHouse {
    pub auction_house_treasury: Pubkey,
    pub treasury_withdrawal_destination: Pubkey,
    pub treasury_mint: Pubkey,
    pub authority: Pubkey,
    pub creator: Pubkey,
    pub seller_fee_basis_points: u16,
    pub discount_collection: Pubkey,
    pub discount_basis_points: u16,
}

#[account]
#[derive(Default)]
pub struct ListingAccount {
    pub owner: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub expiry: u64,
}

#[account]
#[derive(Default)]
pub struct OfferAccount {
    pub buyer: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub expiry: u64,
}
