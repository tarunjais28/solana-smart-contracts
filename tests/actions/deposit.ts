import * as anchor from '@project-serum/anchor';
import { SYSVAR_RENT_PUBKEY, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findEscrowWallet } from '../utils';

export async function deposit(
    program: Program<Marketplace>,
    wallet: Keypair,
    authority: PublicKey,
    treasuryMint: PublicKey,
    amount: anchor.BN
) {
    const isNative = treasuryMint == NATIVE_MINT;
    const auctionHouse = findAuctionHouse(authority, treasuryMint);
    const escrowWallet = findEscrowWallet(wallet.publicKey, auctionHouse);
    const walletAta = (await getOrCreateAssociatedTokenAccount(program.provider.connection, wallet, treasuryMint, wallet.publicKey)).address;

    const tx = await program.methods.deposit(amount)
        .accounts({
            wallet: wallet.publicKey,
            authority: authority,
            treasuryMint: treasuryMint,
            paymentAccount: isNative ? wallet.publicKey : walletAta,
            escrowPaymentAccount: escrowWallet,
            auctionHouse: auctionHouse,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .signers([wallet])
        .rpc();
    return tx;

};
