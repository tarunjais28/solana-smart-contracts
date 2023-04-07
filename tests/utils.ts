import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import * as anchor from '@project-serum/anchor';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const PREFIX = 'marketplace';
export const TREASURY = 'treasury';
export const SIGNER = 'signer';
export const LISTING = 'listing';
export const OFFER = 'offer';

export const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const PROGRAM_ID = new PublicKey("GG2v349mCx2DUL2Pu3aFtKgjxdNjxYYZjUXVhLSbFt8Q");
export const MARKETPLACE_FEE_FACTOR = 0.03; // 3%
export const DISCOUNT_FEE_FACTOR = 0.02; // 2%
export const BASIS_POINTS = 10000;

export const sleep = async (seconds) => {
  await new Promise(f => setTimeout(f, 1000 * seconds));
}

export async function safeAirdrop(connection: anchor.web3.Connection, key: anchor.web3.PublicKey, amount: number) {

  while (await connection.getBalance(key) < amount * LAMPORTS_PER_SOL) {
    try {
      await connection.confirmTransaction(
        await connection.requestAirdrop(key, LAMPORTS_PER_SOL),
        "confirmed"
      );
    } catch { }
  };
}

export const findAuctionHouse = (
  authority: PublicKey, treasuryMint: PublicKey
): PublicKey => {
  let [pubkey, bump] = findProgramAddressSync(
    [Buffer.from(PREFIX), authority.toBuffer(), treasuryMint.toBuffer()],
    PROGRAM_ID,
  );

  return pubkey;
}

export const findAuctionHouseTreasury = (
  auctionHouse: PublicKey
): PublicKey => {
  let [pubkey, bump] = findProgramAddressSync(
    [Buffer.from(PREFIX), auctionHouse.toBuffer(), Buffer.from(TREASURY)],
    PROGRAM_ID,
  );

  return pubkey;
}

export const findEscrowWallet = (
  wallet: PublicKey,
  auctionHouse: PublicKey
): PublicKey => {
  let [pubkey, bump] = findProgramAddressSync(
    [Buffer.from(PREFIX), auctionHouse.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID,
  );

  return pubkey;
}

export const findOfferAccount = (
  wallet: PublicKey,
  nftMint: PublicKey
): PublicKey => {
  let [pubkey, bump] = findProgramAddressSync(
    [Buffer.from(PREFIX), nftMint.toBuffer(), wallet.toBuffer(), Buffer.from(OFFER)],
    PROGRAM_ID,
  );

  return pubkey;
}

export const findListingAccount = (
  nftMint: PublicKey
): PublicKey => {
  let [pubkey, bump] = findProgramAddressSync(
    [Buffer.from(PREFIX), nftMint.toBuffer(), Buffer.from(LISTING)],
    PROGRAM_ID,
  );

  return pubkey;
}

export const findMetadataPda = async (
  mint: PublicKey
): Promise<PublicKey> => {
  const [metadata] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  return metadata;
}

export const findEditionPda = async (
  mint: PublicKey
): Promise<PublicKey> => {
  const [edition] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    METADATA_PROGRAM_ID
  );

  return edition;
}