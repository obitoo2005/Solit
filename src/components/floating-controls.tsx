'use client'

import { ClusterUiSelect } from '@/components/cluster/cluster-ui'
import { ThemeSelect } from '@/components/theme-select'

/**
 * Fixed bottom-right floating utility cluster: cluster (devnet/mainnet) + theme toggle.
 * Hidden on mobile (mobile menu has them inline instead).
 */
export function FloatingControls() {
  return (
    <div className="hidden md:flex fixed bottom-5 right-5 z-40 items-center gap-2 rounded-full border border-foreground/10 bg-background/85 backdrop-blur-md px-2 py-1.5 shadow-lg shadow-black/5">
      <ClusterUiSelect />
      <span className="h-4 w-px bg-foreground/15" />
      <ThemeSelect />
    </div>
  )
}
