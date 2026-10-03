/**
 * Atomic purchase: buyer pays the listed price and the escrowed Core asset
 * moves to the buyer in one transaction.
 *
 * The listed price and the fee come from the on-chain listing/marketplace, not
 * from the UI, so the client cannot influence settlement. The treasury address
 * is read from the marketplace account to satisfy the program's account
 * constraint (`treasury == marketplace.treasury`).
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

export interface BuyRequest {
  assetAddress: string;
  sellerAddress: string;
  collectionAddress?: string | null;
}

export async function submitBuy(
  request: BuyRequest,
  sender: WalletSender,
  connection: Connection
): Promise<string> {
  const program = getProgram(connection, sender.publicKey);
  const asset = new PublicKey(request.assetAddress);
  const marketplace = deriveMarketplacePda();
  const listing = deriveListingPda(asset);
  const seller = new PublicKey(request.sellerAddress);
  const collection = request.collectionAddress
    ? new PublicKey(request.collectionAddress)
    : null;

  const marketplaceAccount = await program.account.marketplace.fetch(marketplace);

  const instruction = await program.methods
    .buyNft()
    .accounts({
      buyer: sender.publicKey,
      marketplace,
      asset,
      listing,
      seller,
      treasury: marketplaceAccount.treasury,
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
