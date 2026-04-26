/**
 * Extract a human-readable message from any thrown value.
 * Handles Error instances, Supabase PostgrestError objects, and plain strings.
 */
export function friendlyError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    // Supabase PostgrestError shape: { message, details, hint, code }
    const parts: string[] = []
    if (typeof obj.message === 'string' && obj.message) parts.push(obj.message)
    if (typeof obj.details === 'string' && obj.details) parts.push(obj.details)
    if (typeof obj.hint === 'string' && obj.hint) parts.push(`(hint: ${obj.hint})`)
    if (typeof obj.code === 'string' && obj.code && parts.length === 0) {
      parts.push(`error ${obj.code}`)
    }
    if (parts.length > 0) return parts.join(' — ')
  }
  return fallback
}

/**
 * Log an error with all its serializable properties so dev tools actually show something.
 * Plain console.error of a Supabase error logs '{}' due to non-enumerable props.
 */
export function logError(label: string, err: unknown) {
  if (err instanceof Error) {
    console.error(`${label}:`, err.message, err.stack)
    return
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    const flat = {
      message: obj.message,
      details: obj.details,
      hint: obj.hint,
      code: obj.code,
      name: obj.name,
      raw: obj,
    }
    console.error(`${label}:`, flat)
    return
  }
  console.error(`${label}:`, err)
}
