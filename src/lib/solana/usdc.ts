import {
  PublicKey,
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getMint,
} from '@solana/spl-token'

/**
 * USDC mint addresses by Solana cluster.
 * - mainnet-beta: official Circle USDC
 * - devnet: Circle's devnet test mint (faucet: https://faucet.circle.com)
 */
export const USDC_MINTS: Record<string, PublicKey> = {
  'mainnet-beta': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  // localnet doesn't have a canonical USDC; use devnet for testing
  localnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
}

export const USDC_DECIMALS = 6

export function getUsdcMint(cluster: string): PublicKey {
  return USDC_MINTS[cluster] ?? USDC_MINTS['devnet']
}

/**
 * Convert cents (integer USD * 100) to USDC base units (USDC has 6 decimals).
 * 1 USD = 100 cents = 1_000_000 USDC base units
 */
export function centsToUsdcBaseUnits(cents: number): bigint {
  return BigInt(cents) * 10_000n
}

/**
 * Convert USDC base units back to cents.
 */
export function usdcBaseUnitsToCents(baseUnits: bigint): number {
  return Number(baseUnits / 10_000n)
}

/**
 * Format cents as USD string (e.g. 1234 -> "$12.34").
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const remainder = abs % 100
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`
}

/**
 * Build a transaction that transfers USDC from `fromWallet` to `toWallet`.
 * Auto-creates the recipient's associated token account if needed (payer: fromWallet).
 *
 * Returns the unsigned transaction. Caller should sign with the wallet adapter and send.
 */
export async function buildUsdcTransferTx(args: {
  connection: Connection
  fromWallet: PublicKey
  toWallet: PublicKey
  amountBaseUnits: bigint
  cluster: string
}): Promise<Transaction> {
  const { connection, fromWallet, toWallet, amountBaseUnits, cluster } = args
  const mint = getUsdcMint(cluster)

  const fromAta = getAssociatedTokenAddressSync(mint, fromWallet)
  const toAta = getAssociatedTokenAddressSync(mint, toWallet)

  const instructions: TransactionInstruction[] = []

  // If the recipient's ATA doesn't exist, the sender pays to create it.
  const toAtaInfo = await connection.getAccountInfo(toAta)
  if (!toAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromWallet, // payer
        toAta, // ata to create
        toWallet, // owner of the new ata
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    )
  }

  instructions.push(createTransferInstruction(fromAta, toAta, fromWallet, amountBaseUnits))

  const tx = new Transaction().add(...instructions)
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = fromWallet
  return tx
}

/**
 * Read a wallet's USDC balance in base units. Returns 0n if the ATA doesn't exist.
 */
export async function getUsdcBalance(args: {
  connection: Connection
  wallet: PublicKey
  cluster: string
}): Promise<bigint> {
  const { connection, wallet, cluster } = args
  const mint = getUsdcMint(cluster)
  const ata = getAssociatedTokenAddressSync(mint, wallet)
  try {
    const account = await getAccount(connection, ata)
    return account.amount
  } catch {
    return 0n
  }
}

/**
 * Build a single transaction that transfers USDC from `fromWallet` to multiple recipients.
 * Auto-creates any missing recipient ATAs (fromWallet pays the rent).
 *
 * This is Solit's differentiator vs Splitwise: a single onchain action settles all your debts.
 * Useful when you owe several people in the same group — one tx, one signature, all transfers atomic.
 *
 * Returns the unsigned transaction. Caller signs via the wallet adapter and sends.
 */
export async function buildBulkUsdcTransferTx(args: {
  connection: Connection
  fromWallet: PublicKey
  transfers: { toWallet: PublicKey; amountBaseUnits: bigint }[]
  cluster: string
}): Promise<Transaction> {
  const { connection, fromWallet, transfers, cluster } = args
  if (transfers.length === 0) throw new Error('No transfers to bundle')

  const mint = getUsdcMint(cluster)
  const fromAta = getAssociatedTokenAddressSync(mint, fromWallet)
  const instructions: TransactionInstruction[] = []

  // Pre-compute recipient ATAs and check which don't exist yet
  const recipientAtas = transfers.map((t) => ({
    toWallet: t.toWallet,
    ata: getAssociatedTokenAddressSync(mint, t.toWallet),
    amountBaseUnits: t.amountBaseUnits,
  }))

  const ataInfos = await Promise.all(
    recipientAtas.map((r) => connection.getAccountInfo(r.ata)),
  )

  recipientAtas.forEach((r, i) => {
    if (!ataInfos[i]) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          fromWallet,
          r.ata,
          r.toWallet,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      )
    }
  })

  for (const r of recipientAtas) {
    instructions.push(createTransferInstruction(fromAta, r.ata, fromWallet, r.amountBaseUnits))
  }

  const tx = new Transaction().add(...instructions)
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  tx.recentBlockhash = blockhash
  tx.feePayer = fromWallet
  return tx
}

// Re-export common SPL helpers so callers don't need to import from spl-token directly.
export { getMint, SystemProgram }
