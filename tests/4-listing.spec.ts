import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NATIVE_MINT, createMint, getAssociatedTokenAddress, mintToChecked, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from '@solana/spl-token';

import PAYER_WALLET from './keypairs/payer.json';
import AUTHORITY_WALLET from './keypairs/authority.json';
import TREASURY_WALLET from './keypairs/treasury.json';
import BT_MINT_WALLET from './keypairs/bt-mint.json';

import { Marketplace } from "../target/types/marketplace";

import * as utils from './utils';
import { deposit } from './actions/deposit';
import { BN } from 'bn.js';
import { assert } from 'chai';
import { listing } from './actions/listing';
import { mintNFT } from './actions/mintNft';
import { unlisting } from './actions/unlisting';
import { buy } from './actions/buy';
import { cancelBuy } from './actions/cancelBuy';

describe("lising", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  // Create test keypairs
  const payer = anchor.web3.Keypair.fromSecretKey(Buffer.from(PAYER_WALLET));
  const authority = anchor.web3.Keypair.fromSecretKey(Buffer.from(AUTHORITY_WALLET));
  const btMint = anchor.web3.Keypair.fromSecretKey(Buffer.from(BT_MINT_WALLET)).publicKey;

  it('Listing NFT with SOL without expiry', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const tx = await listing(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(1_000), null);

    // Get auction house treasurey account
    const auctionHouse = utils.findAuctionHouse(authority.publicKey, NATIVE_MINT);
    const ahTreasury = utils.findAuctionHouseTreasury(auctionHouse);

    // Check NFT ownership
    const nftAccount = await getAssociatedTokenAddress(nftMint, user.publicKey);
    const nftAccInfo = await getAccount(provider.connection, nftAccount);
    assert(nftAccInfo.owner.toString() == ahTreasury.toString(), "NFT ownership not changed.");
  });

  it('Listing NFT with BT token & expiry', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const time = Math.floor(new Date().getTime() / 1000);
    const tx = await listing(program, user, authority.publicKey, btMint, nftMint, new BN(2_000), new BN(time));
  });

  it('Relisting NFT with different price & expiry', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const tx1 = await listing(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(1_000), null);

    const time = Math.floor(new Date().getTime() / 1000);
    const tx2 = await listing(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(8_000), new BN(time));

    // Check listing PDA
    const listingAccount = await utils.findListingAccount(nftMint);
    const listingAcc = await program.account.listingAccount.fetch(listingAccount);
    assert(listingAcc.price.toNumber() == 8_000, "Listing not update.");
  });

  it('Unlisting NFT', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const tx1 = await listing(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(1_000), null);

    const tx2 = await unlisting(program, user, authority.publicKey, NATIVE_MINT, nftMint);

    // Check NFT ownership
    const nftAccount = await getAssociatedTokenAddress(nftMint, user.publicKey);
    const nftAccInfo = await getAccount(provider.connection, nftAccount);
    assert(nftAccInfo.owner.toString() == user.publicKey.toString(), "NFT ownership not changed.");
  });

  it('Set offer', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const tx = await buy(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(1_000), null);

    // Check offer PDA
    const offerAccount = await utils.findOfferAccount(user.publicKey, nftMint);
    const offerAcc = await program.account.offerAccount.fetch(offerAccount);
    assert(offerAcc.price.toNumber() == 1_000, "Offer not update.");
  });

  it('Cancel offer', async () => {

    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const { tokenAccount, edition, mint: nftMint, metadata } = await mintNFT({
      payer: user,
      connection: provider.connection
    });

    const tx = await buy(program, user, authority.publicKey, NATIVE_MINT, nftMint, new BN(1_000), null);

    const tx2 = await cancelBuy(program, user, authority.publicKey, NATIVE_MINT, nftMint);

    // Check offer PDA
    const offerAccount = await utils.findOfferAccount(user.publicKey, nftMint);
    try {
      const offerAcc = await program.account.offerAccount.fetch(offerAccount);
    }
    catch {
      console.log('Success. Offer PDA not exists.')
    }
  });
});
