import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'signal' | 'amber' | 'green' | 'red'

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]',
  signal: 'bg-[var(--color-signal-100)] text-[var(--color-signal-700)]',
  amber: 'bg-[var(--color-amber-100)] text-[var(--color-amber-600)]',
  green: 'bg-[var(--color-green-100)] text-[var(--color-green-600)]',
  red: 'bg-[var(--color-red-100)] text-[var(--color-red-600)]',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
}

export function Badge({ children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        toneStyles[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}
