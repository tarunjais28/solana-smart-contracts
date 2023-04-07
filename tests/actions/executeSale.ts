import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey, AccountMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findAuctionHouseTreasury, findEscrowWallet, findListingAccount, findMetadataPda, findOfferAccount } from '../utils';

export async function executeSale(
    program: Program<Marketplace>,
    buyer: Keypair,
    seller: PublicKey,
    authority: PublicKey,
    treasuryMint: PublicKey,
    nftMint: PublicKey,
    creators: Array<PublicKey> | null = [],
    discountMint: PublicKey | null = null,
    discountTokenAccount: PublicKey | null = null,
    discountMetadata: PublicKey | null = null
) {
    const isNative = treasuryMint == NATIVE_MINT;

    const sellerNftAccount = await getAssociatedTokenAddress(nftMint, seller);
    const nftMetadata = await findMetadataPda(nftMint);
    const buyerReceiptTokenAccount = await getAssociatedTokenAddress(nftMint, buyer.publicKey);
    const sellerPaymentReceiptAccount = isNative ? seller : (await getAssociatedTokenAddress(treasuryMint, seller));

    const auctionHouse = findAuctionHouse(authority, treasuryMint);
    const auctionHouseTreasury = findAuctionHouseTreasury(auctionHouse);
    const escrowWallet = findEscrowWallet(buyer.publicKey, auctionHouse);
    const listingAccount = findListingAccount(nftMint);
    const offerAccount = findOfferAccount(buyer.publicKey, nftMint);

    const remainingAccounts = creators ?
        creators.map(creator => {
            return {
                pubkey: creator,
                isSigner: false,
                isWritable: true
            };
        })
        : [];

    console.log(discountMint?.toString());

    if (discountMint && discountTokenAccount && discountMetadata) {
        remainingAccounts.push({
            pubkey: discountMint,
            isSigner: false,
            isWritable: false
        })
        remainingAccounts.push({
            pubkey: discountTokenAccount,
            isSigner: false,
            isWritable: false
        })
        remainingAccounts.push({
            pubkey: discountMetadata,
            isSigner: false,
            isWritable: false
        })
    }

    try {
        const tx = await program.methods.executeSale()
            .accounts({
                buyer: buyer.publicKey,
                seller: seller,
                escrowPaymentAccount: escrowWallet,
                sellerPaymentReceiptAccount: sellerPaymentReceiptAccount,
                buyerReceiptTokenAccount: buyerReceiptTokenAccount,
                authority: authority,
                treasuryMint: treasuryMint,
                auctionHouse: auctionHouse,
                auctionHouseTreasury: auctionHouseTreasury,
                nftMint: nftMint,
                metadata: nftMetadata,
                nftAccount: sellerNftAccount,
                offerAccount: offerAccount,
                listingAccount: listingAccount,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .remainingAccounts(remainingAccounts)
            .signers([buyer])
            .rpc();
        return tx;
    }
    catch (ex) {
        console.log(ex);
    }

};
