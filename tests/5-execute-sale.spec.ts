import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { createAssociatedTokenAccount, getAccount, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintToChecked, NATIVE_MINT } from '@solana/spl-token';

import PAYER_WALLET from './keypairs/payer.json';
import AUTHORITY_WALLET from './keypairs/authority.json';
import TREASURY_WALLET from './keypairs/treasury.json';
import BT_MINT_WALLET from './keypairs/bt-mint.json';
import DISCOUNT_COLLECTION_WALLET from './keypairs/discount-collection.json';

import { Marketplace } from "../target/types/marketplace";

import * as utils from './utils';
import { deposit } from './actions/deposit';
import { BN } from 'bn.js';
import { assert, util } from 'chai';
import { listing } from './actions/listing';
import { mintNFT } from './actions/mintNft';
import { unlisting } from './actions/unlisting';
import { buy } from './actions/buy';
import { cancelBuy } from './actions/cancelBuy';
import { executeSale } from './actions/executeSale';

describe("execute-sale", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  // Create test keypairs
  const payer = anchor.web3.Keypair.fromSecretKey(Buffer.from(PAYER_WALLET));
  const authority = anchor.web3.Keypair.fromSecretKey(Buffer.from(AUTHORITY_WALLET));
  const btMint = anchor.web3.Keypair.fromSecretKey(Buffer.from(BT_MINT_WALLET)).publicKey;
  const discountCollection = anchor.web3.Keypair.fromSecretKey(Buffer.from(DISCOUNT_COLLECTION_WALLET)).publicKey;

  it('Buy now', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);

    // Mint NFT without creators
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection
    });

    let price = 0.2 * 1_000_000_000; // O.2 SOL

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx2 = await deposit(program, buyer, authority.publicKey, NATIVE_MINT, new BN(price));

    // Make offer with listing price
    const tx3 = await buy(program, buyer, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, NATIVE_MINT);
    const treasury = await utils.findAuctionHouseTreasury(ah);

    const seller_balance_before = await provider.connection.getBalance(seller.publicKey);
    const treasury_balance_before = await provider.connection.getBalance(treasury);

    // Execute sale
    const tx4 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, NATIVE_MINT, nftMint, []);

    // Check marketplace fee
    const treasury_balance_after = await provider.connection.getBalance(treasury);
    const marketplace_fee = price * utils.MARKETPLACE_FEE_FACTOR;
    assert(marketplace_fee == (treasury_balance_after - treasury_balance_before), "Marketplace fee not matched.");

    // Seller will get payment excluding fees and also get closed PDA SOL.
    const seller_balance_after = await provider.connection.getBalance(seller.publicKey);
    const seller_payment = price - marketplace_fee;
    assert((seller_balance_after - seller_balance_before) >= seller_payment, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });

  it('Buy now with creators royalty', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);

    const creator1 = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, creator1.publicKey, 1);

    const creator2 = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, creator2.publicKey, 1);

    // Mint NFT with multiple creators (for royalty test)
    const royalty_fee_factor = 0.02; // 2%
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection,
      sellerFeeBasisPoints: royalty_fee_factor * utils.BASIS_POINTS,
      creators: [
        {
          address: creator1.publicKey,
          share: 20,
          verified: false
        },
        {
          address: creator2.publicKey,
          share: 80,
          verified: false
        },
        {
          address: seller.publicKey,
          share: 0,
          verified: true
        }
      ]
    });

    let creators: Array<anchor.web3.PublicKey> = [];
    creators.push(creator1.publicKey);
    creators.push(creator2.publicKey);
    creators.push(seller.publicKey);

    let price = 0.2 * 1_000_000_000; // O.2 SOL

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx2 = await deposit(program, buyer, authority.publicKey, NATIVE_MINT, new BN(price));

    // Make offer with listing price
    const tx3 = await buy(program, buyer, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, NATIVE_MINT);
    const treasury = await utils.findAuctionHouseTreasury(ah);

    const creator1_balance_before = await provider.connection.getBalance(creator1.publicKey);
    const creator2_balance_before = await provider.connection.getBalance(creator2.publicKey);
    const seller_balance_before = await provider.connection.getBalance(seller.publicKey);
    const treasury_balance_before = await provider.connection.getBalance(treasury);

    // Execute sale
    const tx4 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, NATIVE_MINT, nftMint, creators);

    // Check creator's balance
    const creator1_balance_after = await provider.connection.getBalance(creator1.publicKey);
    const creator1_royalty = price * royalty_fee_factor * 0.2;
    assert(creator1_royalty == (creator1_balance_after - creator1_balance_before), "Creator1's royalty fee not matched.");

    const creator2_balance_after = await provider.connection.getBalance(creator2.publicKey);
    const creator2_royalty = price * royalty_fee_factor * 0.8;
    assert(creator2_royalty == (creator2_balance_after - creator2_balance_before), "Creator2's royalty fee not matched.");

    // Check marketplace fee
    const treasury_balance_after = await provider.connection.getBalance(treasury);
    const marketplace_fee = price * utils.MARKETPLACE_FEE_FACTOR;
    assert(marketplace_fee == (treasury_balance_after - treasury_balance_before), "Marketplace fee not matched.");

    // Seller will get payment excluding fees and also get closed PDA SOL.
    const seller_balance_after = await provider.connection.getBalance(seller.publicKey);
    const seller_payment = price - creator1_royalty - creator2_royalty - marketplace_fee;
    assert((seller_balance_after - seller_balance_before) >= seller_payment, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });

  it('Buy with offer', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);

    // Mint NFT without creators
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection
    });

    let price = 0.2 * 1_000_000_000; // O.2 SOL

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, NATIVE_MINT, nftMint, new BN(0.5 * 1_000_000_000), null);

    // Make offer with different price
    const tx2 = await buy(program, buyer, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx3 = await deposit(program, buyer, authority.publicKey, NATIVE_MINT, new BN(price));

    // Update listing with offer price
    const tx4 = await listing(program, seller, authority.publicKey, NATIVE_MINT, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, NATIVE_MINT);
    const treasury = await utils.findAuctionHouseTreasury(ah);

    const seller_balance_before = await provider.connection.getBalance(seller.publicKey);
    const treasury_balance_before = await provider.connection.getBalance(treasury);

    // Execute sale
    const tx5 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, NATIVE_MINT, nftMint, []);

    // Check marketplace fee
    const treasury_balance_after = await provider.connection.getBalance(treasury);
    const marketplace_fee = price * utils.MARKETPLACE_FEE_FACTOR;
    assert(marketplace_fee == (treasury_balance_after - treasury_balance_before), "Marketplace fee not matched.");

    // Seller will get payment excluding fees and also get closed PDA SOL.
    const seller_balance_after = await provider.connection.getBalance(seller.publicKey);
    const seller_payment = price - marketplace_fee;
    assert((seller_balance_after - seller_balance_before) >= seller_payment, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });

  it('Buy now with BT token', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);
    const sellerTokenAccount = await getAssociatedTokenAddress(btMint, seller.publicKey);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, payer, btMint, buyer.publicKey);
    await mintToChecked(provider.connection, payer, btMint, buyerTokenAccount, authority, 1_000_000_000, 9);

    // Mint NFT without creators
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection
    });

    let price = 0.2 * 1_000_000_000; // O.2 BT

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, btMint, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx2 = await deposit(program, buyer, authority.publicKey, btMint, new BN(price));

    // Make offer with listing price
    const tx3 = await buy(program, buyer, authority.publicKey, btMint, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, btMint);
    const treasury = await utils.findAuctionHouseTreasury(ah);

    // Execute sale
    const tx4 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, btMint, nftMint, []);

    // Check marketplace fee
    const treasury_balance = (await getAccount(provider.connection, treasury)).amount;
    const marketplace_fee = BigInt(price * utils.MARKETPLACE_FEE_FACTOR);
    assert(marketplace_fee == treasury_balance, "Marketplace fee not matched.");

    // Seller will get payment excluding fees.
    const seller_balance = (await getAccount(provider.connection, sellerTokenAccount)).amount;
    const seller_payment = BigInt(price) - marketplace_fee;
    assert(seller_balance == seller_payment, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });

  it('Buy with offer & creators & BT token', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);
    const sellerTokenAccount = await getAssociatedTokenAddress(btMint, seller.publicKey);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, payer, btMint, buyer.publicKey);
    await mintToChecked(provider.connection, payer, btMint, buyerTokenAccount, authority, 1_000_000_000, 9);

    const creator = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, creator.publicKey, 1);
    const creatorTokenAccount = await getAssociatedTokenAddress(btMint, creator.publicKey);

    // Mint NFT with multiple creators (for royalty test)
    const royalty_fee_factor = 0.02; // 2%
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection,
      sellerFeeBasisPoints: royalty_fee_factor * utils.BASIS_POINTS,
      creators: [
        {
          address: creator.publicKey,
          share: 100,
          verified: false
        },
        {
          address: seller.publicKey,
          share: 0,
          verified: true
        }
      ]
    });

    let creators: Array<anchor.web3.PublicKey> = [];
    // If not SOL listing, then needs to append creator address and token account too
    creators.push(creator.publicKey);
    creators.push(creatorTokenAccount);
    creators.push(seller.publicKey);
    creators.push(sellerTokenAccount);

    let price = 0.2 * 1_000_000_000; // O.2 BT

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, btMint, nftMint, new BN(0.5 * 1_000_000_000), null);

    // Make offer with different price
    const tx2 = await buy(program, buyer, authority.publicKey, btMint, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx3 = await deposit(program, buyer, authority.publicKey, btMint, new BN(price));

    // Update listing with offer price
    const tx4 = await listing(program, seller, authority.publicKey, btMint, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, btMint);
    const treasury = await utils.findAuctionHouseTreasury(ah);
    const treasury_balance_before = (await getAccount(provider.connection, treasury)).amount;

    // Execute sale
    const tx5 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, btMint, nftMint, creators);

    // Check creator's balance
    const creator_balance = (await getAccount(provider.connection, creatorTokenAccount)).amount;
    const creator_royalty = BigInt(price * royalty_fee_factor);
    assert(creator_royalty == creator_balance, "Creator's royalty fee not matched.");

    // Check marketplace fee
    const treasury_balance_after = (await getAccount(provider.connection, treasury)).amount;
    const marketplace_fee = BigInt(price * utils.MARKETPLACE_FEE_FACTOR);
    assert(marketplace_fee == (treasury_balance_after - treasury_balance_before), "Marketplace fee not matched.");

    // Seller will get payment excluding fees.
    const seller_balance = (await getAccount(provider.connection, sellerTokenAccount)).amount;
    const seller_payment = BigInt(price) - marketplace_fee - creator_royalty;
    assert(seller_payment == seller_balance, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });

  it('Buy with offer & creators & BT token & discount', async () => {

    const seller = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, seller.publicKey, 1);
    const sellerTokenAccount = await getAssociatedTokenAddress(btMint, seller.publicKey);

    const buyer = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, buyer.publicKey, 1);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, payer, btMint, buyer.publicKey);
    await mintToChecked(provider.connection, payer, btMint, buyerTokenAccount, authority, 1_000_000_000, 9);

    const creator = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, creator.publicKey, 1);
    const creatorTokenAccount = await getAssociatedTokenAddress(btMint, creator.publicKey);

    // Mint NFT with multiple creators (for royalty test)
    const royalty_fee_factor = 0.02; // 2%
    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: seller,
      connection: provider.connection,
      sellerFeeBasisPoints: royalty_fee_factor * utils.BASIS_POINTS,
      creators: [
        {
          address: creator.publicKey,
          share: 100,
          verified: false
        },
        {
          address: seller.publicKey,
          share: 0,
          verified: true
        }
      ]
    });
    const { tokenAccount: discountTokenAccount, edition: discountEdition, mint: discountMint, metadata: discountMetadata } = await mintNFT({
      payer: buyer,
      connection: provider.connection,
      collectionMint: discountCollection
    });

    let creators: Array<anchor.web3.PublicKey> = [];
    // If not SOL listing, then needs to append creator address and token account too
    creators.push(creator.publicKey);
    creators.push(creatorTokenAccount);
    creators.push(seller.publicKey);
    creators.push(sellerTokenAccount);

    let price = 0.2 * 1_000_000_000; // O.2 BT

    // Listing item first
    const tx1 = await listing(program, seller, authority.publicKey, btMint, nftMint, new BN(0.5 * 1_000_000_000), null);

    // Make offer with different price
    const tx2 = await buy(program, buyer, authority.publicKey, btMint, nftMint, new BN(price), null);

    // Deposit tokens to escrow account
    const tx3 = await deposit(program, buyer, authority.publicKey, btMint, new BN(price));

    // Update listing with offer price
    const tx4 = await listing(program, seller, authority.publicKey, btMint, nftMint, new BN(price), null);

    const ah = await utils.findAuctionHouse(authority.publicKey, btMint);
    const treasury = await utils.findAuctionHouseTreasury(ah);
    const treasury_balance_before = (await getAccount(provider.connection, treasury)).amount;

    // Execute sale with discount
    const tx5 = await executeSale(program, buyer, seller.publicKey, authority.publicKey, btMint, nftMint, creators, discountMint, discountTokenAccount, discountMetadata);

    // Check creator's balance
    const creator_balance = (await getAccount(provider.connection, creatorTokenAccount)).amount;
    const creator_royalty = BigInt(price * royalty_fee_factor);
    assert(creator_royalty == creator_balance, "Creator's royalty fee not matched.");

    // Check marketplace fee
    const treasury_balance_after = (await getAccount(provider.connection, treasury)).amount;
    const marketplace_fee = BigInt(price * utils.MARKETPLACE_FEE_FACTOR);
    const discounted_fee = BigInt(price * utils.DISCOUNT_FEE_FACTOR);
    assert(discounted_fee == (treasury_balance_after - treasury_balance_before), "Discounted fee not matched.");

    // Seller will get payment excluding fees.
    const seller_balance = (await getAccount(provider.connection, sellerTokenAccount)).amount;
    const seller_payment = BigInt(price) - marketplace_fee - creator_royalty;
    assert(seller_payment == seller_balance, "Seller fee not matched.");

    // Check NFT ownership
    const buyerNftAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const buyerNftInfo = await getAccount(provider.connection, buyerNftAccount);
    assert(buyerNftInfo.owner.equals(buyer.publicKey) && (buyerNftInfo.amount == BigInt(1)), "NFT not sent to buyer.");

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller.publicKey);
    const sellerNftInfo = await getAccount(provider.connection, sellerNftAccount);
    assert(sellerNftInfo.amount == BigInt(0), "NFT still in buyer.");
  });
});
