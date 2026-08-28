import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

interface StatCardProps {
  label: string
  value: number | string
  icon: ReactNode
  accent?: 'signal' | 'amber' | 'green' | 'neutral'
}

const accentStyles = {
  signal: 'bg-[var(--color-signal-50)] text-[var(--color-signal-600)]',
  amber: 'bg-[var(--color-amber-50)] text-[var(--color-amber-600)]',
  green: 'bg-[var(--color-green-100)] text-[var(--color-green-600)]',
  neutral: 'bg-[var(--color-ink-100)] text-[var(--color-ink-600)]',
}

export function StatCard({ label, value, icon, accent = 'neutral' }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accentStyles[accent]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-[var(--color-ink-900)]">{value}</p>
        <p className="text-sm text-[var(--color-ink-500)]">{label}</p>
      </div>
    </Card>
  )
}
