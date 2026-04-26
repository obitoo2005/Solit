'use client'

import { motion, type Variants, type MotionProps, type Transition } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * Apple-style easing curves.
 * - APPLE_EASE: their signature cubic-bezier (smooth deceleration)
 * - APPLE_SPRING: tactile, slight overshoot, no oscillation
 */
export const APPLE_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
export const APPLE_SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
}

/* ---------- Reusable variants ---------- */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: APPLE_EASE },
  },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: APPLE_EASE } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.65, ease: APPLE_EASE },
  },
}

export const stagger = (delay = 0, gap = 0.08): Variants => ({
  hidden: {},
  show: {
    transition: {
      delayChildren: delay,
      staggerChildren: gap,
    },
  },
})

/* ---------- Wrapper components ---------- */

type FadeUpProps = {
  children: ReactNode
  delay?: number
  className?: string
  as?: keyof typeof motion
} & Omit<MotionProps, 'variants' | 'initial' | 'animate'>

export function FadeUp({ children, delay = 0, className, ...rest }: FadeUpProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.7, ease: APPLE_EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StaggerGroup({
  children,
  className,
  delay = 0,
  gap = 0.08,
}: {
  children: ReactNode
  className?: string
  delay?: number
  gap?: number
}) {
  return (
    <motion.div variants={stagger(delay, gap)} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  variants = fadeUp,
}: {
  children: ReactNode
  className?: string
  variants?: Variants
}) {
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  )
}

/**
 * Tactile button-press feel (Apple-style).
 * Scale 0.97 on tap, subtle hover. Respects prefers-reduced-motion automatically.
 */
export function TapScale({
  children,
  className,
  scale = 0.97,
  hover = 1.0,
}: {
  children: ReactNode
  className?: string
  scale?: number
  hover?: number
}) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      whileHover={{ scale: hover }}
      transition={APPLE_SPRING}
    >
      {children}
    </motion.div>
  )
}

/**
 * Card lift on hover — subtle shadow + Y translate.
 */
export function HoverLift({
  children,
  className,
  y = -2,
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ y }}
      transition={{ duration: 0.3, ease: APPLE_EASE }}
    >
      {children}
    </motion.div>
  )
}
