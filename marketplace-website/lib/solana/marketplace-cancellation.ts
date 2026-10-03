/**
 * Cancellation: the seller reclaims the escrowed Core asset. The on-chain
 * program authorises only the listing's seller and transfers escrow → seller.
 */

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

export interface CancelRequest {
  assetAddress: string;
  collectionAddress?: string | null;
}

export async function submitCancel(
  request: CancelRequest,
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
    .cancelListing()
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
