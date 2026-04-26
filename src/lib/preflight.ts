import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { toast } from 'sonner'
import { getUsdcBalance, usdcBaseUnitsToCents } from '@/lib/solana/usdc'

/**
 * Pre-flight balance checks for settlement transactions.
 *
 * Goal: don't open the wallet popup if the tx is going to fail anyway.
 * Surface a friendly, actionable message instead so the user can request
 * an airdrop or hit the USDC faucet before signing.
 */

/**
 * Conservative minimum SOL needed for a settlement transaction:
 * - One transfer + maybe an ATA creation (~0.00203 SOL rent for a token account)
 * - Plus signature fee (~0.000005 SOL)
 * - Buffer of 0.001 SOL for safety
 *
 * In lamports.
 */
export const MIN_SOL_FOR_USDC_TX_LAMPORTS = 0.005 * LAMPORTS_PER_SOL // 5_000_000
export const MIN_SOL_FOR_NATIVE_TX_LAMPORTS = 0.0001 * LAMPORTS_PER_SOL // 100_000

export type PreflightResult =
  | { ok: true }
  | {
      ok: false
      kind: 'no-sol-for-gas' | 'insufficient-sol' | 'insufficient-usdc'
      message: string
      /** Optional human-readable hint about how to fix it. */
      hint?: string
      /** If we have a way to recover (airdrop, faucet, etc.), include a label + url-or-action. */
      action?: { label: string; href?: string }
    }

export type SettleAsset = 'USDC' | 'SOL'

/**
 * Check whether the wallet has enough balance to perform a settlement.
 *
 * For USDC settlement: needs USDC for the amount + a tiny bit of SOL for gas.
 * For SOL settlement:  needs SOL for the amount + gas.
 */
export async function checkSettlePreflight(args: {
  connection: Connection
  wallet: PublicKey
  cluster: string
  asset: SettleAsset
  /** Total settlement amount in cents. For USDC, this is the USDC value. For SOL, this is the USD-equivalent we'll convert via solPrice. */
  amountCents: number
  /** When asset === 'SOL', the total amount of lamports to be transferred. Required for SOL preflight. */
  amountLamports?: bigint
  /** Whether we're on a devnet/testnet cluster — used to surface the right recovery action. */
  isDevnetLike: boolean
}): Promise<PreflightResult> {
  const { connection, wallet, cluster, asset, amountCents, amountLamports, isDevnetLike } = args

  // Always need SOL for gas
  let solBalance: number
  try {
    solBalance = await connection.getBalance(wallet, 'confirmed')
  } catch (e) {
    // If RPC fails, don't block the user — let the wallet show the error.
    console.warn('Preflight: SOL balance check failed', e)
    return { ok: true }
  }

  if (asset === 'SOL') {
    if (amountLamports == null) {
      // We can't pre-check without the lamport amount; let the wallet show the error.
      return { ok: true }
    }
    const required = amountLamports + BigInt(MIN_SOL_FOR_NATIVE_TX_LAMPORTS)
    if (BigInt(solBalance) < required) {
      const have = (solBalance / LAMPORTS_PER_SOL).toFixed(4)
      const need = (Number(required) / LAMPORTS_PER_SOL).toFixed(4)
      return {
        ok: false,
        kind: 'insufficient-sol',
        message: `Not enough SOL — you have ${have}, need ${need}`,
        hint: isDevnetLike ? 'Request a devnet airdrop and try again.' : undefined,
        action: isDevnetLike ? { label: 'Open faucet', href: 'https://faucet.solana.com' } : undefined,
      }
    }
    return { ok: true }
  }

  // USDC path: need both gas AND USDC
  if (solBalance < MIN_SOL_FOR_USDC_TX_LAMPORTS) {
    const have = (solBalance / LAMPORTS_PER_SOL).toFixed(4)
    return {
      ok: false,
      kind: 'no-sol-for-gas',
      message: `Need a tiny bit of SOL for gas — you have ${have} SOL`,
      hint: isDevnetLike
        ? 'Request a devnet airdrop. Even on devnet, every tx needs ~0.005 SOL for fees + token account rent.'
        : 'Top up your wallet with a fraction of SOL to cover the network fee.',
      action: isDevnetLike ? { label: 'Open faucet', href: 'https://faucet.solana.com' } : undefined,
    }
  }

  // Check USDC balance
  let usdcBaseUnits: bigint
  try {
    usdcBaseUnits = await getUsdcBalance({ connection, wallet, cluster })
  } catch (e) {
    console.warn('Preflight: USDC balance check failed', e)
    return { ok: true }
  }

  const haveCents = usdcBaseUnitsToCents(usdcBaseUnits)
  if (haveCents < amountCents) {
    const haveDollars = (haveCents / 100).toFixed(2)
    const needDollars = (amountCents / 100).toFixed(2)
    return {
      ok: false,
      kind: 'insufficient-usdc',
      message: `Not enough USDC — you have $${haveDollars}, need $${needDollars}`,
      hint: isDevnetLike
        ? 'Mint devnet USDC from Circle\u2019s faucet (free). Paste your wallet address and select Solana Devnet.'
        : 'Top up USDC on this wallet, or switch to settling in SOL.',
      action: isDevnetLike
        ? { label: 'Open USDC faucet', href: 'https://faucet.circle.com/' }
        : undefined,
    }
  }

  return { ok: true }
}

/**
 * Surface a preflight failure as a sonner toast with an actionable button
 * (open the relevant faucet) when available.
 *
 * Use right before bailing out of a settle handler:
 *   const pre = await checkSettlePreflight(...)
 *   if (!pre.ok) { showPreflightFailure(pre); return }
 */
export function showPreflightFailure(result: Extract<PreflightResult, { ok: false }>) {
  toast.error(result.message, {
    description: result.hint,
    duration: 8000,
    action: result.action?.href
      ? {
          label: result.action.label,
          onClick: () => window.open(result.action!.href, '_blank', 'noopener,noreferrer'),
        }
      : undefined,
  })
}
