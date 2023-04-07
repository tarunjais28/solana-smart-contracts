import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NATIVE_MINT, getAssociatedTokenAddress, mintToChecked } from '@solana/spl-token';

import PAYER_WALLET from './keypairs/payer.json';
import AUTHORITY_WALLET from './keypairs/authority.json';
import TREASURY_WALLET from './keypairs/treasury.json';
import BT_MINT_WALLET from './keypairs/bt-mint.json';
import DISCOUNT_COLLECTION_WALLET from './keypairs/discount-collection.json';

import { Marketplace } from "../target/types/marketplace";
import { createAuctionHouse } from './actions/createAuctionHouse';
import { updateAuctionHouse } from './actions/updateAuctionHouse';
import { withdrawFromTreasury } from './actions/withdrawFromTreasury';

import * as utils from './utils';
import { assert } from 'chai';

describe("auction-house", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  // Create test keypairs
  const payer = anchor.web3.Keypair.fromSecretKey(Buffer.from(PAYER_WALLET));
  const authority = anchor.web3.Keypair.fromSecretKey(Buffer.from(AUTHORITY_WALLET));
  const treasuryWithdraw = anchor.web3.Keypair.fromSecretKey(Buffer.from(TREASURY_WALLET));
  const btMint = anchor.web3.Keypair.fromSecretKey(Buffer.from(BT_MINT_WALLET)).publicKey;
  const discountCollection = anchor.web3.Keypair.fromSecretKey(Buffer.from(DISCOUNT_COLLECTION_WALLET)).publicKey;

  it('Create auction house with SOL', async () => {
    const tx = await createAuctionHouse(program, payer, authority.publicKey, NATIVE_MINT, treasuryWithdraw.publicKey, discountCollection, 500, 500);
  });

  it('Create auction house with BT token', async () => {
    const tx = await createAuctionHouse(program, payer, authority.publicKey, btMint, treasuryWithdraw.publicKey, discountCollection, utils.MARKETPLACE_FEE_FACTOR * utils.BASIS_POINTS, utils.DISCOUNT_FEE_FACTOR * utils.BASIS_POINTS);
  });

  it('Update auction house', async () => {
    const tx = await updateAuctionHouse(program, payer, authority, authority.publicKey, authority.publicKey, NATIVE_MINT, treasuryWithdraw.publicKey, utils.MARKETPLACE_FEE_FACTOR * utils.BASIS_POINTS, utils.DISCOUNT_FEE_FACTOR * utils.BASIS_POINTS, null);
  });

  it('Withdraw from auction house treasury', async () => {

    const amount = 500;

    // Send some BT tokens to PDA for test
    const ah = utils.findAuctionHouse(authority.publicKey, btMint);
    const ahTreasury = utils.findAuctionHouseTreasury(ah);
    await mintToChecked(provider.connection, payer, btMint, ahTreasury, authority, amount, 9);

    // Get balance before transaction and compare
    const treasuryWithdrawAta = await getAssociatedTokenAddress(btMint, treasuryWithdraw.publicKey);
    const beforeBalance = (await provider.connection.getTokenAccountBalance(treasuryWithdrawAta)).value.uiAmount ?? 0;

    const tx = await withdrawFromTreasury(program, authority, btMint, treasuryWithdrawAta, amount);

    const afterBalance = (await provider.connection.getTokenAccountBalance(treasuryWithdrawAta)).value.uiAmount ?? 0;
    assert(afterBalance > beforeBalance, "Balance not updated.");
  });

});
