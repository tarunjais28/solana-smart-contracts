import * as anchor from '@project-serum/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';

import { Marketplace } from "../../target/types/marketplace";
import { findAuctionHouse, findAuctionHouseTreasury } from '../utils';
import { BN } from 'bn.js';

export async function withdrawFromTreasury(
    program: Program<Marketplace>,
    authority: Keypair,
    treasuryMint: PublicKey,
    treasuryWithdraw: PublicKey,
    amount: number
) {
    const auctionHouse = findAuctionHouse(authority.publicKey, treasuryMint);
    const auctionHouseTreasury = findAuctionHouseTreasury(auctionHouse);

    const tx = await program.methods.withdrawFromTreasury(new BN(amount))
        .accounts({
            authority: authority.publicKey,
            treasuryMint: treasuryMint,
            treasuryWithdrawalDestination: treasuryWithdraw,
            auctionHouse: auctionHouse,
            auctionHouseTreasury: auctionHouseTreasury,
            systemProgram: anchor.web3.SystemProgram.programId
        })
        .signers([authority])
        .rpc();
    return tx;

};
