import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findAuctionHouseTreasury } from '../utils';

export async function createAuctionHouse(
    program: Program<Marketplace>,
    payer: Keypair,
    authority: PublicKey,
    treasuryMint: PublicKey,
    treasuryWithdrawOwner: PublicKey,
    discountCollection: PublicKey,
    sellerFeeBasispoints: number,
    discountBasisPoints: number
) {
    const auctionHouse = findAuctionHouse(authority, treasuryMint);
    const auctionHouseTreasury = findAuctionHouseTreasury(auctionHouse);

    let treasuryWithdraw = treasuryWithdrawOwner;
    if (treasuryMint != NATIVE_MINT) {
        treasuryWithdraw = await getAssociatedTokenAddress(treasuryMint, treasuryWithdrawOwner);
    }

    const tx = await program.methods.createAuctionHouse(sellerFeeBasispoints, discountCollection, discountBasisPoints)
        .accounts({
            payer: payer.publicKey,
            authority: authority,
            treasuryMint: treasuryMint,
            treasuryWithdrawalDestination: treasuryWithdraw,
            treasuryWithdrawalDestinationOwner: treasuryWithdrawOwner,
            auctionHouse: auctionHouse,
            auctionHouseTreasury: auctionHouseTreasury,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .signers([payer])
        .rpc();
    return tx;

};
