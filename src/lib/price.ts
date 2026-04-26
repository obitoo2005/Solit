/**
 * Lightweight SOL/USD price feed via CoinGecko (free, no API key needed).
 * Cached for 30s to avoid rate-limit issues during rapid testing.
 */

let cachedPrice: { value: number; ts: number } | null = null
const CACHE_MS = 30_000

export async function getSolUsdPrice(): Promise<number> {
  const now = Date.now()
  if (cachedPrice && now - cachedPrice.ts < CACHE_MS) {
    return cachedPrice.value
  }
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    { cache: 'no-store' },
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch SOL price (${res.status})`)
  }
  const json: { solana?: { usd?: number } } = await res.json()
  const usd = json?.solana?.usd
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
    throw new Error('Invalid SOL price response')
  }
  cachedPrice = { value: usd, ts: now }
  return usd
}

/**
 * Convert USD cents to lamports given current SOL price.
 * Lamports per SOL = 1_000_000_000.
 */
export function centsToLamports(cents: number, solUsdPrice: number): bigint {
  if (solUsdPrice <= 0) throw new Error('Invalid SOL price')
  const usd = cents / 100
  const sol = usd / solUsdPrice
  const lamports = Math.round(sol * 1_000_000_000)
  return BigInt(lamports)
}

/**
 * Format a SOL amount (in lamports) as a short string with up to `decimals` decimals.
 * 1234567890n → "1.2346 SOL" (4 decimals)
 */
export function formatSol(lamports: bigint, decimals = 4): string {
  const sol = Number(lamports) / 1_000_000_000
  return `${sol.toFixed(decimals)} SOL`
}

/** Format lamports back as a USD-equivalent string given a price. */
export function lamportsToUsdLabel(lamports: bigint, solUsdPrice: number): string {
  const sol = Number(lamports) / 1_000_000_000
  const usd = sol * solUsdPrice
  return `~$${usd.toFixed(2)}`
}
