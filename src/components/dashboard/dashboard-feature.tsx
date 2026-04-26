'use client'

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { StaggerGroup, StaggerItem, fadeUp, scaleIn, APPLE_EASE, APPLE_SPRING } from '@/components/motion'

const useCases = ['Trips', 'Roommates', 'Dinners', 'Rent', 'Subscriptions', 'Group gifts']

export function DashboardFeature() {
  return (
    <div className="solit-grid relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <StaggerGroup className="mx-auto max-w-6xl px-6 pt-10 pb-32 sm:pt-14 lg:pt-16" delay={0.1} gap={0.12}>
        {/* Intro chip */}
        <StaggerItem className="flex justify-center">
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={APPLE_SPRING}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-background/70 backdrop-blur-sm pl-3 pr-1 py-1 text-xs font-mono-tight"
          >
            <span className="text-muted-foreground">Introducing Solit</span>
            <Link
              href="/groups"
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-90"
            >
              Try now
              <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        </StaggerItem>

        {/* Editorial headline */}
        <StaggerItem>
          <h1 className="mt-10 text-center font-display text-5xl leading-[1.04] sm:text-7xl lg:text-8xl lg:leading-[0.98] tracking-tight">
            Split bills.
            <br />
            Settle on Solana.
          </h1>
        </StaggerItem>

        <StaggerItem>
          <p className="mx-auto mt-8 max-w-2xl text-center text-base text-muted-foreground sm:text-lg lg:text-xl">
            Solit lets friends track shared expenses and settle balances directly in USDC onchain — in one tap, in
            under a second, for fractions of a cent.
          </p>
        </StaggerItem>

        {/* Settle-up mock card — animates in with scale */}
        <StaggerItem variants={scaleIn} className="mx-auto mt-14 max-w-3xl">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.4, ease: APPLE_EASE }}
            className="rounded-2xl bg-zinc-900 text-zinc-100 shadow-2xl shadow-black/20 ring-1 ring-black/5 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <span className="font-mono-tight text-[11px] uppercase tracking-wider text-zinc-400">
                solit · goa trip
              </span>
              <span className="font-mono-tight text-[11px] text-zinc-500">devnet</span>
            </div>

            <motion.div
              variants={{
                hidden: {},
                show: { transition: { delayChildren: 0.4, staggerChildren: 0.08 } },
              }}
              initial="hidden"
              animate="show"
              className="px-6 py-7 space-y-3"
            >
              {[
                { label: 'You owe Alex', value: '$42.50', tone: 'neutral' },
                { label: 'Sarah owes you', value: '+$18.00', tone: 'positive' },
                { label: 'Net', value: '−$24.50', tone: 'neutral', divider: true },
              ].map((row, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className={`flex items-center justify-between text-sm ${row.divider ? 'border-t border-white/10 pt-3' : ''}`}
                >
                  <span className="text-zinc-400">{row.label}</span>
                  <span
                    className={`font-mono-tight tabular-nums text-base ${
                      row.tone === 'positive' ? 'text-emerald-300' : 'text-zinc-100'
                    }`}
                  >
                    {row.value}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            <div className="px-6 pb-6">
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.005 }}
                transition={APPLE_SPRING}
                className="group flex w-full items-center justify-between rounded-lg bg-white text-zinc-900 px-4 py-3 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Settle 24.50 USDC to Alex
                </span>
                <motion.span
                  initial={{ x: 0, y: 0 }}
                  whileHover={{ x: 2, y: -2 }}
                  transition={APPLE_SPRING}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </motion.span>
              </motion.button>
              <p className="mt-2 text-center text-[11px] text-zinc-500 font-mono-tight">
                onchain · ~0.0001 SOL gas · &lt; 1 second
              </p>
            </div>
          </motion.div>
        </StaggerItem>

        {/* Use case chips — staggered in with their own group */}
        <StaggerItem className="mx-auto mt-12 max-w-3xl">
          <motion.div
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.04 } },
            }}
            initial="hidden"
            animate="show"
            className="flex flex-wrap justify-center gap-2"
          >
            {useCases.map((label) => (
              <motion.span
                key={label}
                variants={fadeUp}
                whileHover={{ y: -2, scale: 1.03 }}
                transition={APPLE_SPRING}
                className="inline-flex items-center rounded-md border border-foreground/15 bg-background/70 px-3 py-1.5 text-xs font-mono-tight text-foreground/80 cursor-default"
              >
                {label}
              </motion.span>
            ))}
          </motion.div>
        </StaggerItem>

        {/* Bottom CTA */}
        <StaggerItem className="mt-16 flex flex-col items-center gap-3">
          <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} transition={APPLE_SPRING}>
            <Link
              href="/groups"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
            >
              Open the app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
          <p className="text-xs text-muted-foreground font-mono-tight">Built on Solana · Powered by USDC</p>
        </StaggerItem>
      </StaggerGroup>
    </div>
  )
}
