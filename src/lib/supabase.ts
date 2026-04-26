import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

let _client: SupabaseClient | null = null

/**
 * Lazy Supabase client. Only throws when first accessed without env vars,
 * so static / pre-render code paths don't crash during build.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See SETUP.md for the full setup.',
        )
      }
      _client = createClient(supabaseUrl, supabaseAnonKey)
    }
    return Reflect.get(_client, prop)
  },
})

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string
          name: string
          creator_wallet: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          creator_wallet: string
          created_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          wallet: string
          display_name: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          wallet: string
          display_name?: string | null
          joined_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          group_id: string
          payer_wallet: string
          amount_cents: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          payer_wallet: string
          amount_cents: number
          description: string
          created_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          group_id: string
          from_wallet: string
          to_wallet: string
          amount_cents: number
          tx_signature: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          from_wallet: string
          to_wallet: string
          amount_cents: number
          tx_signature: string
          created_at?: string
        }
      }
    }
  }
}
