'use client'

import { ThemeSelect } from '@/components/theme-select'

/**
 * Fixed bottom-right floating utility: theme toggle only.
 * Cluster switcher is available via the mobile menu.
 * Hidden on mobile (mobile menu has theme inline instead).
 */
export function FloatingControls() {
  return (
    <div className="hidden md:flex fixed bottom-5 right-5 z-40 items-center rounded-full border border-foreground/10 bg-background/85 backdrop-blur-md p-1 shadow-lg shadow-black/5">
      <ThemeSelect />
    </div>
  )
}
