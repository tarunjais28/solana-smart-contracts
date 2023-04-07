import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { NATIVE_MINT, createMint, getAssociatedTokenAddress, mintToChecked, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';

import PAYER_WALLET from './keypairs/payer.json';
import AUTHORITY_WALLET from './keypairs/authority.json';
import TREASURY_WALLET from './keypairs/treasury.json';
import BT_MINT_WALLET from './keypairs/bt-mint.json';

import { Marketplace } from "../target/types/marketplace";

import * as utils from './utils';
import { deposit } from './actions/deposit';
import { BN } from 'bn.js';
import { assert } from 'chai';

describe("deposit", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Marketplace as Program<Marketplace>;

  // Create test keypairs
  const payer = anchor.web3.Keypair.fromSecretKey(Buffer.from(PAYER_WALLET));
  const authority = anchor.web3.Keypair.fromSecretKey(Buffer.from(AUTHORITY_WALLET));
  const treasuryWithdraw = anchor.web3.Keypair.fromSecretKey(Buffer.from(TREASURY_WALLET));
  const btMint = anchor.web3.Keypair.fromSecretKey(Buffer.from(BT_MINT_WALLET)).publicKey;

  it('Deposit SOL to escrow wallet', async () => {
    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const amount = 1_000;

    const auctionHouse = utils.findAuctionHouse(authority.publicKey, NATIVE_MINT);
    const escrowWallet = utils.findEscrowWallet(user.publicKey, auctionHouse);

    const tx = await deposit(program, user, authority.publicKey, NATIVE_MINT, new BN(amount));

    const balance = await provider.connection.getBalance(escrowWallet);
    assert(balance > 0, "Deposit balance not matched.");
  });

  it('Deposit BT token to escrow wallet', async () => {
    const user = anchor.web3.Keypair.generate();
    await utils.safeAirdrop(provider.connection, user.publicKey, 1);

    const amount = 1_000;

    // Mint BT tokens to user
    const userAta = (await getOrCreateAssociatedTokenAccount(provider.connection, payer, btMint, user.publicKey)).address;
    await mintToChecked(provider.connection, payer, btMint, userAta, authority, amount, 9);

    const auctionHouse = utils.findAuctionHouse(authority.publicKey, btMint);
    const escrowWallet = utils.findEscrowWallet(user.publicKey, auctionHouse);

    const tx = await deposit(program, user, authority.publicKey, btMint, new BN(amount));

    const balance = await provider.connection.getTokenAccountBalance(escrowWallet);
    assert(balance.value.amount == amount.toString(), "Deposit balance not matched.");
  });
});
