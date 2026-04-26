import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

/**
 * Build a single-recipient SOL transfer transaction.
 * No token account / ATA creation needed — SOL is native.
 */
export async function buildSolTransferTx(args: {
  connection: Connection
  fromWallet: PublicKey
  toWallet: PublicKey
  amountLamports: bigint
}): Promise<Transaction> {
  const { connection, fromWallet, toWallet, amountLamports } = args
  if (amountLamports <= 0n) throw new Error('Amount must be > 0')

  const ix = SystemProgram.transfer({
    fromPubkey: fromWallet,
    toPubkey: toWallet,
    lamports: amountLamports,
  })

  const tx = new Transaction().add(ix)
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = fromWallet
  return tx
}

/**
 * Build a single transaction that sends SOL from one wallet to multiple recipients.
 * Atomic: either every transfer lands or none do (one signature, one tx).
 */
export async function buildBulkSolTransferTx(args: {
  connection: Connection
  fromWallet: PublicKey
  transfers: { toWallet: PublicKey; amountLamports: bigint }[]
}): Promise<Transaction> {
  const { connection, fromWallet, transfers } = args
  if (transfers.length === 0) throw new Error('No transfers to bundle')

  const instructions: TransactionInstruction[] = transfers.map((t) =>
    SystemProgram.transfer({
      fromPubkey: fromWallet,
      toPubkey: t.toWallet,
      lamports: t.amountLamports,
    }),
  )

  const tx = new Transaction().add(...instructions)
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = fromWallet
  return tx
}
