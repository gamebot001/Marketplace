/**
 * Escrow listing: seller transfers a Metaplex Core asset into the listing PDA.
 *
 * The on-chain program re-checks that the seller owns the asset before the
 * transfer; this module only assembles the real instruction and submits it
 * through the connected wallet.
 */

import { BN } from "@anchor-lang/core";
import {
  PublicKey,
  SystemProgram,
  type Connection,
} from "@solana/web3.js";
import {
  MPL_CORE_PROGRAM_ID,
  buildTransaction,
  deriveListingPda,
  deriveMarketplacePda,
  getProgram,
} from "./marketplace-program";
import {
  signSendAndConfirm,
  type WalletSender,
} from "./solana-confirmation";

export interface ListRequest {
  assetAddress: string;
  collectionAddress?: string | null;
  priceLamports: bigint;
}

export async function submitList(
  request: ListRequest,
  sender: WalletSender,
  connection: Connection
): Promise<string> {
  const program = getProgram(connection, sender.publicKey);
  const asset = new PublicKey(request.assetAddress);
  const marketplace = deriveMarketplacePda();
  const listing = deriveListingPda(asset);
  const collection = request.collectionAddress
    ? new PublicKey(request.collectionAddress)
    : null;

  const instruction = await program.methods
    .createListing(new BN(request.priceLamports.toString()))
    .accounts({
      seller: sender.publicKey,
      marketplace,
      asset,
      listing,
      mplCoreProgram: MPL_CORE_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      collection,
    })
    .instruction();

  return signSendAndConfirm(
    sender,
    connection,
    buildTransaction(sender.publicKey, instruction)
  );
}
