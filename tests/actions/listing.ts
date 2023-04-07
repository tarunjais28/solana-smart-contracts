import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findAuctionHouseTreasury, findEscrowWallet, findListingAccount } from '../utils';

export async function listing(
    program: Program<Marketplace>,
    wallet: Keypair,
    authority: PublicKey,
    treasuryMint: PublicKey,
    nftMint: PublicKey,
    price: anchor.BN,
    expiry: anchor.BN | null,
) {
    const auctionHouse = findAuctionHouse(authority, treasuryMint);
    const auctionHouseTreasury = findAuctionHouseTreasury(auctionHouse);
    const listingAccount = findListingAccount(nftMint);
    const nftAccount = await getAssociatedTokenAddress(nftMint, wallet.publicKey);

    try {
        const tx = await program.methods.list(price, expiry)
            .accounts({
                seller: wallet.publicKey,
                authority: authority,
                treasuryMint: treasuryMint,
                auctionHouse: auctionHouse,
                auctionHouseTreasury: auctionHouseTreasury,
                nftMint: nftMint,
                nftAccount: nftAccount,
                listingAccount: listingAccount,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([wallet])
            .rpc();
        return tx;
    }
    catch (ex) {
        console.log(ex);
    }

};
