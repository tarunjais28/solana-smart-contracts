use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, program::invoke_signed, system_instruction},
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use mpl_token_metadata::state::Metadata;

use crate::{constant::*, error::*, states::*, utils::*};

#[derive(Accounts)]
pub struct ExecuteSale<'info> {
    /// Buyer user wallet account.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Validated in execute_sale_logic.
    /// Seller user wallet account.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: Validated in execute_sale_logic.
    // cannot mark these as real Accounts or else we blow stack size limit
    /// Auction House treasury mint account.
    pub treasury_mint: UncheckedAccount<'info>,

    /// CHECK: Not dangerous. Account seeds checked in constraint.
    /// Buyer escrow payment account PDA.
    #[account(
        mut,
        seeds = [
            PREFIX,
            auction_house.key().as_ref(),
            buyer.key().as_ref()
        ],
        bump
    )]
    pub escrow_payment_account: UncheckedAccount<'info>,

    /// CHECK: Validated in execute_sale_logic.
    /// Seller SOL or SPL account to receive payment at.
    #[account(mut)]
    pub seller_payment_receipt_account: UncheckedAccount<'info>,

    /// CHECK: Validated in execute_sale_logic.
    /// Buyer SPL token account to receive purchased item at.
    #[account(mut)]
    pub buyer_receipt_token_account: UncheckedAccount<'info>,

    /// Auction House instance authority account.
    /// CHECK: Validated as a auction house signer.
    pub authority: UncheckedAccount<'info>,

    /// Auction House treasury PDA account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(mut, seeds=[PREFIX, auction_house.key().as_ref(), TREASURY], bump)]
    pub auction_house_treasury: UncheckedAccount<'info>,

    /// Auction House instance PDA account.
    #[account(
        seeds = [
            PREFIX,
            auction_house.creator.as_ref(),
            auction_house.treasury_mint.as_ref()
        ],
        bump,
        has_one=authority,
        has_one=treasury_mint,
        has_one=auction_house_treasury
    )]
    pub auction_house: Box<Account<'info, AuctionHouse>>,
    
    /// CHECK: Validated in execute_sale_logic.
    /// NFT mint account
    pub nft_mint: UncheckedAccount<'info>,

    /// NFT token account
    #[account(mut,
        constraint = nft_account.mint == nft_mint.key()
    )]
    pub nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Validated in execute_sale_logic.
    /// Metaplex metadata account decorating SPL mint account.
    pub metadata: UncheckedAccount<'info>,

    /// Listing PDA account
    #[account(
        mut,
        seeds=[
            PREFIX,
            nft_mint.key().as_ref(),
            LISTING
        ],
        bump,
        close = seller,
        constraint = listing_account.owner == seller.key(),
        constraint = listing_account.nft_mint == nft_mint.key(),
    )]
    pub listing_account: Account<'info, ListingAccount>,

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
        close = buyer,
        constraint = offer_account.buyer == buyer.key(),
        constraint = offer_account.nft_mint == nft_mint.key(),
    )]
    pub offer_account: Account<'info, OfferAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub ata_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle<'info>(ctx: Context<'_, '_, '_, 'info, ExecuteSale<'info>>) -> Result<()> {

    let buyer = &ctx.accounts.buyer;
    let seller = &ctx.accounts.seller;
    let auction_house = &ctx.accounts.auction_house;
    let auction_house_treasury = &ctx.accounts.auction_house_treasury;
    let metadata = &ctx.accounts.metadata;
    let treasury_mint = &ctx.accounts.treasury_mint;
    let listing_account = &ctx.accounts.listing_account;
    let offer_account = &ctx.accounts.offer_account;
    let nft_mint = &ctx.accounts.nft_mint;
    let nft_account = &ctx.accounts.nft_account;
    let seller_payment_receipt_account = &ctx.accounts.seller_payment_receipt_account;
    let buyer_receipt_token_account = &ctx.accounts.buyer_receipt_token_account;
    let escrow_payment_account = &ctx.accounts.escrow_payment_account;
    let system_program = &ctx.accounts.system_program;
    let ata_program = &ctx.accounts.ata_program;
    let token_program = &ctx.accounts.token_program;
    let rent = &ctx.accounts.rent;

    let metadata_clone = metadata.to_account_info();
    let escrow_clone = escrow_payment_account.to_account_info();
    let auction_house_clone = auction_house.to_account_info();
    let ata_clone = ata_program.to_account_info();
    let token_clone = token_program.to_account_info();
    let sys_clone = system_program.to_account_info();
    let rent_clone = rent.to_account_info();
    let treasury_clone = auction_house_treasury.to_account_info();
    let buyer_receipt_clone = buyer_receipt_token_account.to_account_info();
    let token_account_clone = nft_account.to_account_info();

    let price = listing_account.price;

    let is_native = treasury_mint.key() == spl_token::native_mint::id();

    // Check expired offer or listing
    let now = Clock::get()?.unix_timestamp as u64;
    require!(
        listing_account.expiry == 0 ||
        listing_account.expiry < now,
        MarketplaceError::InvalidExpiry,
    );
    require!(
        offer_account.expiry == 0 ||
        offer_account.expiry < now,
        MarketplaceError::InvalidExpiry,
    );

    // Check offer and listing price is same
    require!(
        listing_account.price == offer_account.price,
        MarketplaceError::InvalidAmount,
    );

    // Check NFT token ownership (needs to be in treasury account)
    assert_is_ata2(
        &nft_account.to_account_info(),
        &seller.key(),
        &nft_mint.key(),
        &auction_house_treasury.key(),
    )?;

    // Check NFT account balance
    require!(nft_account.amount > 0, MarketplaceError::InvalidAmount);

    // Check metadata is correct
    assert_derivation(
        &mpl_token_metadata::id(),
        &metadata.to_account_info(),
        &[
            mpl_token_metadata::state::PREFIX.as_bytes(),
            mpl_token_metadata::id().as_ref(),
            nft_mint.key().as_ref()
        ],
    )?;

    if metadata.data_is_empty() {
        return Err(MarketplaceError::InvalidAccountInput.into());
    }
    // For native purchases, verify that the amount in escrow is sufficient to actually purchase the token.
    // This is intended to cover the migration from pre-rent-exemption checked accounts to rent-exemption checked accounts.
    // The fee payer makes up the shortfall up to the amount of rent for an empty account.
    if is_native {
        let diff = rent_checked_sub(escrow_payment_account.to_account_info(), price)?;
        if diff != price {
            // Return the shortfall amount (if greater than 0 but less than rent), but don't exceed the minimum rent the account should need.
            let shortfall = std::cmp::min(
                price
                    .checked_sub(diff)
                    .ok_or(MarketplaceError::NumericalOverflow)?,
                rent.minimum_balance(escrow_payment_account.data_len()),
            );
            invoke(
                &system_instruction::transfer(buyer.key, escrow_payment_account.key, shortfall),
                &[
                    buyer.to_account_info(),
                    escrow_payment_account.to_account_info(),
                    system_program.to_account_info(),
                ]
            )?;
        }
    }

    let ah_key = auction_house.key();
    let wallet_key = buyer.key();
    let escrow_signer_seeds = [
        PREFIX,
        ah_key.as_ref(),
        wallet_key.as_ref(),
        &[bump(&[PREFIX, ah_key.as_ref(), wallet_key.as_ref()], ctx.program_id)]
    ];

    let ah_seeds = [
        PREFIX,
        auction_house.creator.as_ref(),
        auction_house.treasury_mint.as_ref(),
        &[bump(&[PREFIX, auction_house.creator.as_ref(), auction_house.treasury_mint.as_ref()], ctx.program_id)]
    ];

    // with the native account, the escrow is its own owner,
    // whereas with token, it is the auction house that is owner.
    let signer_seeds_for_royalties = if is_native {
        escrow_signer_seeds
    } else {
        ah_seeds
    };

    let remaining_accounts = &mut ctx.remaining_accounts.iter();

    let buyer_leftover_after_royalties = pay_creator_fees(
        remaining_accounts,
        &metadata_clone,
        &escrow_clone,
        &auction_house_clone,
        buyer,
        treasury_mint,
        &ata_clone,
        &token_clone,
        &sys_clone,
        &rent_clone,
        &signer_seeds_for_royalties,
        &[],
        price,
        is_native,
    )?;

    // Check discount NFT metadata
    let mut is_discount = false;
    let remain_discount_mint = next_account_info(remaining_accounts).ok();    

    if let Some(discount_mint) = remain_discount_mint {
        let discount_account = next_account_info(remaining_accounts)?;
        let discount_metadata = next_account_info(remaining_accounts)?;

        if discount_metadata.data_is_empty() {
            return Err(MarketplaceError::InvalidDiscountAccount.into());
        }
        else {
            // Check discount NFT is valid        
            let discount_ata = assert_is_ata(
                &discount_account.to_account_info(),
                &buyer.key(),
                &discount_mint.key(),
            )?;
    
            // Check discount ATA balance
            if discount_ata.amount < 1 {
                return Err(MarketplaceError::InvalidDiscountAccount.into());
            }
    
            // Check discount metadata
            assert_derivation(
                &mpl_token_metadata::id(),
                &discount_metadata.to_account_info(),
                &[
                    mpl_token_metadata::state::PREFIX.as_bytes(),
                    mpl_token_metadata::id().as_ref(),
                    discount_mint.key().as_ref()
                ],
            )?;
    
            // Check discount account is valid collection
            let _discount_metadata = Metadata::from_account_info(discount_metadata)?;
            if let Some(collection) = _discount_metadata.collection {
                require!(collection.verified && collection.key == auction_house.discount_collection, MarketplaceError::InvalidDiscountAccount);
                is_discount = true;
            }
            else {
                return Err(MarketplaceError::InvalidDiscountAccount.into());
            }
        }
    }

    msg!("Discount: {}", is_discount);

    let auction_house_fee_paid = pay_auction_house_fees(
        auction_house,
        &treasury_clone,
        &escrow_clone,
        &token_clone,
        &sys_clone,
        &signer_seeds_for_royalties,
        price,
        is_native,
        is_discount
    )?;

    let buyer_leftover_after_royalties_and_house_fee = buyer_leftover_after_royalties
        .checked_sub(auction_house_fee_paid)
        .ok_or(MarketplaceError::NumericalOverflow)?;

    if !is_native {
        if seller_payment_receipt_account.data_is_empty() {
            make_ata(
                seller_payment_receipt_account.to_account_info(),
                seller.to_account_info(),
                treasury_mint.to_account_info(),
                buyer.to_account_info(),
                ata_program.to_account_info(),
                token_program.to_account_info(),
                system_program.to_account_info(),
                rent.to_account_info(),
                &[],
            )?;
        }

        let seller_rec_acct = assert_is_ata(
            &seller_payment_receipt_account.to_account_info(),
            &seller.key(),
            &treasury_mint.key(),
        )?;

        // make sure you cant get rugged
        if seller_rec_acct.delegate.is_some() {
            return Err(MarketplaceError::SellerATACannotHaveDelegate.into());
        }

        invoke_signed(
            &spl_token::instruction::transfer(
                token_program.key,
                &escrow_payment_account.key(),
                &seller_payment_receipt_account.key(),
                &auction_house.key(),
                &[],
                buyer_leftover_after_royalties_and_house_fee,
            )?,
            &[
                escrow_payment_account.to_account_info(),
                seller_payment_receipt_account.to_account_info(),
                token_program.to_account_info(),
                auction_house.to_account_info(),
            ],
            &[&ah_seeds],
        )?;
    } else {
        assert_keys_equal(seller_payment_receipt_account.key(), seller.key())?;
        invoke_signed(
            &system_instruction::transfer(
                escrow_payment_account.key,
                seller_payment_receipt_account.key,
                buyer_leftover_after_royalties_and_house_fee,
            ),
            &[
                escrow_payment_account.to_account_info(),
                seller_payment_receipt_account.to_account_info(),
                system_program.to_account_info(),
            ],
            &[&escrow_signer_seeds],
        )?;
    }

    // Check buyer NFT ATA is valid
    if buyer_receipt_token_account.data_is_empty() {
        make_ata(
            buyer_receipt_token_account.to_account_info(),
            buyer.to_account_info(),
            nft_mint.to_account_info(),
            buyer.to_account_info(),
            ata_program.to_account_info(),
            token_program.to_account_info(),
            system_program.to_account_info(),
            rent.to_account_info(),
            &[],
        )?;
    }

    let buyer_rec_acct = assert_is_ata(&buyer_receipt_clone, &buyer.key(), &nft_mint.key())?;

    // make sure you cant get rugged
    if buyer_rec_acct.delegate.is_some() {
        return Err(MarketplaceError::BuyerATACannotHaveDelegate.into());
    }

    // Transfer NFT to buyer
    let treasury_signer_seeds = &[
        PREFIX,
        ah_key.as_ref(),
        TREASURY,
        &[bump(&[
            PREFIX,
            ah_key.as_ref(),
            TREASURY,
        ], ctx.program_id)],
    ];
    let treasury_signer = &[&treasury_signer_seeds[..]];

    let cpi_account = Transfer {
        from: token_account_clone,
        to: buyer_receipt_clone,
        authority: treasury_clone
    };

    let cpi_ctx = CpiContext::new_with_signer(
        token_clone,
        cpi_account,
        treasury_signer
    );

    token::transfer(cpi_ctx, 1)?;

    Ok(())
}
