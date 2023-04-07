import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse } from '../utils';

export async function updateAuctionHouse(
    program: Program<Marketplace>,
    payer: Keypair,
    authority: Keypair,
    newAuthority: PublicKey,
    creator: PublicKey,
    treasuryMint: PublicKey,
    treasuryWithdrawOwner: PublicKey,
    seller_fee_basis_points: number | null,
    discount_basis_points: number | null,
    discount_collection: PublicKey | null,
) {
    const auctionHouse = findAuctionHouse(creator, treasuryMint);

    let treasuryWithdraw = treasuryWithdrawOwner;
    if (treasuryMint != NATIVE_MINT) {
        treasuryWithdraw = await getAssociatedTokenAddress(treasuryMint, treasuryWithdrawOwner);
    }

    const tx = await program.methods.updateAuctionHouse(
        seller_fee_basis_points,
        discount_collection,
        discount_basis_points,
    )
        .accounts({
            payer: payer.publicKey,
            authority: authority.publicKey,
            newAuthority: newAuthority,
            treasuryMint: treasuryMint,
            treasuryWithdrawalDestination: treasuryWithdraw,
            treasuryWithdrawalDestinationOwner: treasuryWithdrawOwner,
            auctionHouse: auctionHouse,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .signers([payer, authority])
        .rpc();
    return tx;

};
