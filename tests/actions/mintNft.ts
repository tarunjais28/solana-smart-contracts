import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
    PROGRAM_ID,
    createCreateMasterEditionV3Instruction,
    Creator,
    DataV2,
    createCreateMetadataAccountV2Instruction,
    Metadata,
} from '@metaplex-foundation/mpl-token-metadata';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore createMintToInstruction export actually exist but isn't setup correctly
import { createAssociatedTokenAccount, createMint, createMintToInstruction, mintToChecked, transfer } from '@solana/spl-token';
import { findEditionPda, findMetadataPda } from '../utils';

type MintNFTParams = {
    payer: Keypair;
    connection: Connection;
    maxSupply?: number;
    creators?: Creator[];
    sellerFeeBasisPoints?: number;
    collectionMint?: PublicKey;
};

const URI = 'https://arweave.net/Rmg4pcIv-0FQ7M7X838p2r592Q4NU63Fj7o7XsvBHEE';
const NAME = 'test';
const SYMBOL = 'sym';

export async function mintNFT({
    payer,
    connection,
    creators,
    collectionMint,
    sellerFeeBasisPoints = 10,
    maxSupply = 100,
}: MintNFTParams) {
    const mint = await createMint(connection, payer, payer.publicKey, null, 0);

    const tokenAccount = await createAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    await mintToChecked(connection, payer, mint, tokenAccount, payer, 1, 0);

    const data: DataV2 = {
        uri: URI,
        name: NAME,
        symbol: SYMBOL,
        sellerFeeBasisPoints: sellerFeeBasisPoints,
        creators: creators ?? null,
        collection: collectionMint
            ? {
                key: collectionMint,
                verified: false,
            }
            : null,
        uses: null,
    };

    let transaction = new Transaction();

    const metadata = await findMetadataPda(mint);
    const createMetadataInstruction = createCreateMetadataAccountV2Instruction(
        {
            metadata,
            mint: mint,
            updateAuthority: payer.publicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
        },
        { createMetadataAccountArgsV2: { isMutable: true, data } },
    );
    transaction.add(createMetadataInstruction);

    const edition = await findEditionPda(mint);
    const masterEditionInstruction = createCreateMasterEditionV3Instruction(
        {
            edition,
            metadata,
            updateAuthority: payer.publicKey,
            mint: mint,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
        },
        {
            createMasterEditionArgs: { maxSupply },
        },
    );
    transaction.add(masterEditionInstruction);

    const tx = await connection.sendTransaction(transaction, [payer]);
    // console.log(tx);

    return { tokenAccount, edition, mint, metadata };
}
