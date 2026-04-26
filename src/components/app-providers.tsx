'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { ProfileProvider } from '@/components/profile/profile-context'
import React from 'react'

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <ClusterProvider>
          <SolanaProvider>
            <ProfileProvider>{children}</ProfileProvider>
          </SolanaProvider>
        </ClusterProvider>
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
