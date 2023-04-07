use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("AlreadyInUse")]
    AlreadyInUse,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid state")]
    InvalidState,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid expiry")]
    InvalidExpiry,
    #[msg("Missing creator")]
    MissingCreator,
    #[msg("NotAllowed")]
    NotAllowed,
    #[msg("Math operation overflow")]
    NumericalOverflow,
    #[msg("InvalidAccountInput")]
    InvalidAccountInput,
    #[msg("InvalidPubkey")]
    InvalidPubkey,
    #[msg("Uninitialized")]
    Uninitialized,

    #[msg("Buyer ata cannot have a delegate set")]
    BuyerATACannotHaveDelegate,

    #[msg("Seller ata cannot have a delegate set")]
    SellerATACannotHaveDelegate,
    
    #[msg("Invalid discount account")]
    InvalidDiscountAccount,

}
