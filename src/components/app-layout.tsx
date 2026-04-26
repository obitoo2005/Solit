'use client'

import { Toaster } from './ui/sonner'
import { AppHeader } from '@/components/app-header'
import React from 'react'
import { AppFooter } from '@/components/app-footer'
import { ClusterChecker } from '@/components/cluster/cluster-ui'
import { FloatingControls } from '@/components/floating-controls'
import { ConfirmDialogHost } from '@/lib/confirm'

export function AppLayout({
  children,
  links,
}: {
  children: React.ReactNode
  links: { label: string; path: string }[]
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader links={links} />
      <main className="flex-grow">
        <ClusterChecker>{null}</ClusterChecker>
        {children}
      </main>
      <AppFooter />
      <FloatingControls />
      <Toaster />
      <ConfirmDialogHost />
    </div>
  )
}
