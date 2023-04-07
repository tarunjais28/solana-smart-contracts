# NFT Marketplace (Solana)

Contract name: `marketplace`



### Function `create_auction_house`

Full name: `auction_house::create_auction_house`

#### Parameters in binary

```
Parameter ::= (seller_fee_basis_points: u16) (discount_collection: Pubkey) (discount_basis_points: u16)
```

#### Accounts

```
payer: Signer<'info>
treasury_mint: Account<'info, Mint>
authority: UncheckedAccount<'info>
treasury_withdrawal_destination: UncheckedAccount<'info>
treasury_withdrawal_destination_owner: UncheckedAccount<'info>
auction_house: Account<'info, AuctionHouse>
auction_house_treasury: UncheckedAccount<'info>
token_program: Program<'info, Token>
system_program: Program<'info, System>
ata_program: Program<'info, AssociatedToken>
rent: Sysvar<'info, Rent>
```



### Function `update_auction_house`

Full name: `auction_house::update_auction_house`

#### Parameters in binary

```
Parameter ::= (seller_fee_basis_points: Option<u16>) (discount_collection: Option<Pubkey>) (discount_basis_points: Option<u16>)
```

#### Accounts

```
payer: Signer<'info>
treasury_mint: Account<'info, Mint>
authority: UncheckedAccount<'info>
new_authority: UncheckedAccount<'info>
treasury_withdrawal_destination: UncheckedAccount<'info>
treasury_withdrawal_destination_owner: UncheckedAccount<'info>
auction_house: Account<'info, AuctionHouse>
token_program: Program<'info, Token>
system_program: Program<'info, System>
ata_program: Program<'info, AssociatedToken>
rent: Sysvar<'info, Rent>
```



### Function `withdraw_from_treasury`

Full name: `auction_house::withdraw_from_treasury`

#### Parameters in binary

```
Parameter ::= (amount: u64)
```

#### Accounts

```
authority: Signer<'info>
treasury_mint: Account<'info, Mint>
authority: UncheckedAccount<'info>
treasury_withdrawal_destination: UncheckedAccount<'info>
auction_house: Account<'info, AuctionHouse>
auction_house_treasury: UncheckedAccount<'info>
token_program: Program<'info, Token>
system_program: Program<'info, System>
```



### Function `list`

Full name: `listing::list`

#### Parameters in binary

```
Parameter ::= (price: u64) (seller_expiry: Option<u64>)
```

#### Accounts

```
seller: Signer<'info>,
treasury_mint: Account<'info, Mint>,
authority: UncheckedAccount<'info>,
auction_house: Account<'info, AuctionHouse>,
auction_house_treasury: UncheckedAccount<'info>,
nft_mint: UncheckedAccount<'info>,
nft_account: Box<Account<'info, TokenAccount>>,
listing_account: Account<'info, ListingAccount>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
rent: Sysvar<'info, Rent>,
```

#### Logs

{"price": PRICE, "seller_expiry": EXPIRY}





### Function `unlisting`

Full name: `listing::unlisting`

#### Parameters in binary

```
```

#### Accounts

```
seller: Signer<'info>,
treasury_mint: Account<'info, Mint>,
authority: UncheckedAccount<'info>,
auction_house: Account<'info, AuctionHouse>,
auction_house_treasury: UncheckedAccount<'info>,
nft_mint: UncheckedAccount<'info>,
nft_account: Box<Account<'info, TokenAccount>>,
listing_account: Account<'info, ListingAccount>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
```




### Function `buy`

Full name: `listing::buy`

#### Parameters in binary

```
Parameter ::= (price: u64) (buyer_expiry: Option<u64>)
```

#### Accounts

```
buyer: Signer<'info>,
treasury_mint: Account<'info, Mint>,
authority: UncheckedAccount<'info>,
auction_house: Account<'info, AuctionHouse>,
nft_mint: UncheckedAccount<'info>,
offer_account: Account<'info, OfferAccount>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
rent: Sysvar<'info, Rent>
```

#### Logs

{"price": PRICE, "buyer_expiry": EXPIRY}




### Function `cancel_buy`

Full name: `listing::cancel_buy`

#### Parameters in binary

```
```

#### Accounts

```
buyer: Signer<'info>,
treasury_mint: Account<'info, Mint>,
authority: UncheckedAccount<'info>,
auction_house: Account<'info, AuctionHouse>,
nft_mint: UncheckedAccount<'info>,
offer_account: Account<'info, OfferAccount>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
```




### Function `deposit`

Full name: `deposit::handle`

#### Parameters in binary

```
Parameter ::= (amount: u64)
```

#### Accounts

```
wallet: Signer<'info>,
payment_account: UncheckedAccount<'info>,
escrow_payment_account: UncheckedAccount<'info>
treasury_mint: Account<'info, Mint>,
authority: UncheckedAccount<'info>,
auction_house: Account<'info, AuctionHouse>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
rent: Sysvar<'info, Rent>
```




### Function `execute_sale`

Full name: `execute_sale::handle`

#### Parameters in binary

```
Parameter ::= (amount: u64)
```

#### Accounts

```
buyer: Signer<'info>,
seller: UncheckedAccount<'info>,
treasury_mint: UncheckedAccount<'info>,
escrow_payment_account: UncheckedAccount<'info>,
seller_payment_receipt_account: UncheckedAccount<'info>,
buyer_receipt_token_account: UncheckedAccount<'info>,
authority: UncheckedAccount<'info>,
auction_house_treasury: UncheckedAccount<'info>,
auction_house: Box<Account<'info, AuctionHouse>>,
nft_mint: UncheckedAccount<'info>,
nft_account: Box<Account<'info, TokenAccount>>,
metadata: UncheckedAccount<'info>,
listing_account: Account<'info, ListingAccount>,
offer_account: Account<'info, OfferAccount>,
token_program: Program<'info, Token>,
system_program: Program<'info, System>,
ata_program: Program<'info, AssociatedToken>,
rent: Sysvar<'info, Rent>,
```

#### Remaining Accounts

```
creators: Array<UncheckedAccount<'info>>, // If NFT have creators for share royalty fee
discount_mint: UncheckedAccount<'info>, // If buyer have discountable NFT
discount_token_account: UncheckedAccount<'info>,
discount_metadata: UncheckedAccount<'info>,
```

