import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findOfferAccount } from '../utils';

export async function buy(
    program: Program<Marketplace>,
    wallet: Keypair,
    authority: PublicKey,
    treasuryMint: PublicKey,
    nftMint: PublicKey,
    price: anchor.BN,
    expiry: anchor.BN | null,
) {
    const auctionHouse = findAuctionHouse(authority, treasuryMint);
    const offerAccount = findOfferAccount(wallet.publicKey, nftMint);

    try {
        const tx = await program.methods.buy(price, expiry)
            .accounts({
                buyer: wallet.publicKey,
                authority: authority,
                treasuryMint: treasuryMint,
                auctionHouse: auctionHouse,
                nftMint: nftMint,
                offerAccount: offerAccount,
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
