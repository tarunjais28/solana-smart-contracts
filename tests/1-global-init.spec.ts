import * as anchor from '@project-serum/anchor';
import { MintLayout, createInitializeMintInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SystemProgram, Transaction } from '@solana/web3.js';

import PAYER_WALLET from './keypairs/payer.json';
import AUTHORITY_WALLET from './keypairs/authority.json';
import TREASURY_WALLET from './keypairs/treasury.json';
import BT_MINT_WALLET from './keypairs/bt-mint.json';
import DISCOUNT_COLLECTION_WALLET from './keypairs/discount-collection.json';

import * as utils from './utils';

describe("Initialize environment", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  // Create test keypairs
  const payer = anchor.web3.Keypair.fromSecretKey(Buffer.from(PAYER_WALLET));
  const authority = anchor.web3.Keypair.fromSecretKey(Buffer.from(AUTHORITY_WALLET));
  const treasuryWithdraw = anchor.web3.Keypair.fromSecretKey(Buffer.from(TREASURY_WALLET));
  const btMint = anchor.web3.Keypair.fromSecretKey(Buffer.from(BT_MINT_WALLET));
  const discountCollection = anchor.web3.Keypair.fromSecretKey(Buffer.from(DISCOUNT_COLLECTION_WALLET)).publicKey;

  it('Prepare test wallets', async () => {
    // Airdrop sol to the test users
    await utils.safeAirdrop(provider.connection, payer.publicKey, 1);
    await utils.safeAirdrop(provider.connection, authority.publicKey, 1);
    await utils.safeAirdrop(provider.connection, treasuryWithdraw.publicKey, 1);
  });

  it('Prepare mint tokens', async () => {
    let accountRentExempt = await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );

    const tx = new Transaction();
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: btMint.publicKey,
        lamports: accountRentExempt,
        space: MintLayout.span,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    tx.add(
      createInitializeMintInstruction(
        btMint.publicKey,
        9,
        authority.publicKey,
        authority.publicKey
      )
    );

    const hash = await provider.sendAndConfirm(
      tx,
      [authority, btMint],
      { commitment: 'confirmed' }
    );
  });

});
