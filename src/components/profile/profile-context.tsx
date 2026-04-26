'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getProfile, listProfiles, upsertProfile, type Profile } from '@/lib/groups'

type ProfileContextValue = {
  /** Profile of the connected wallet, or null if none yet. */
  myProfile: Profile | null
  /** Lookup table of wallet -> Profile loaded so far. */
  profilesByWallet: Record<string, Profile>
  /** Load profiles for the given wallet list (de-duped, idempotent). */
  loadProfiles: (wallets: string[]) => Promise<void>
  /** Save the connected user's display name. */
  saveMyName: (name: string) => Promise<void>
  /** Returns the best available name for a wallet (falls back to short wallet). */
  resolveName: (wallet: string | undefined) => string
  /** Whether the connected user has set up their profile. */
  needsOnboarding: boolean
  myProfileLoading: boolean
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

function shortenWallet(wallet: string) {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet()
  const myWallet = publicKey?.toBase58()

  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profilesByWallet, setProfilesByWallet] = useState<Record<string, Profile>>({})
  const [myProfileLoading, setMyProfileLoading] = useState(false)

  // Mirror the state in a ref so loadProfiles stays referentially stable.
  const profilesRef = useRef<Record<string, Profile>>({})

  // Load my profile when wallet changes
  useEffect(() => {
    if (!myWallet) {
      setMyProfile(null)
      return
    }
    let cancelled = false
    setMyProfileLoading(true)
    getProfile(myWallet)
      .then((p) => {
        if (cancelled) return
        setMyProfile(p)
        if (p) {
          profilesRef.current = { ...profilesRef.current, [p.wallet]: p }
          setProfilesByWallet(profilesRef.current)
        }
      })
      .catch((err) => console.error('Failed to load profile', err))
      .finally(() => {
        if (!cancelled) setMyProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [myWallet])

  // Stable: never re-creates. Reads cache from ref to avoid stale-deps bugs.
  const loadProfiles = useCallback(async (wallets: string[]) => {
    const missing = Array.from(new Set(wallets.filter((w) => !!w && !profilesRef.current[w])))
    if (missing.length === 0) return
    try {
      const fetched = await listProfiles(missing)
      profilesRef.current = { ...profilesRef.current, ...fetched }
      setProfilesByWallet(profilesRef.current)
    } catch (err) {
      console.error('Failed to load profiles', err)
    }
  }, [])

  const saveMyName = useCallback(
    async (name: string) => {
      if (!myWallet) throw new Error('Connect your wallet first')
      const updated = await upsertProfile({ wallet: myWallet, displayName: name })
      setMyProfile(updated)
      profilesRef.current = { ...profilesRef.current, [updated.wallet]: updated }
      setProfilesByWallet(profilesRef.current)
    },
    [myWallet],
  )

  const resolveName = useCallback(
    (wallet: string | undefined) => {
      if (!wallet) return 'Unknown'
      const profile = profilesByWallet[wallet]
      if (profile?.display_name) return profile.display_name
      return shortenWallet(wallet)
    },
    [profilesByWallet],
  )

  const value = useMemo<ProfileContextValue>(
    () => ({
      myProfile,
      profilesByWallet,
      loadProfiles,
      saveMyName,
      resolveName,
      needsOnboarding: !!myWallet && !myProfile && !myProfileLoading,
      myProfileLoading,
    }),
    [myProfile, profilesByWallet, loadProfiles, saveMyName, resolveName, myWallet, myProfileLoading],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be used inside <ProfileProvider>')
  return ctx
}

/** Convenience: shorten a wallet outside of context. */
export { shortenWallet }
