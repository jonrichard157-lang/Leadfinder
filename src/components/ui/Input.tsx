import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-[var(--color-ink-700)]', className)}
      {...props}
    />
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
}

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">
          {icon}
        </span>
      )}
      <input
        className={cn(
          'w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] transition-colors focus:border-[var(--color-signal-500)]',
          Boolean(icon) && 'pl-10',
          className
        )}
        {...props}
      />
    </div>
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink-900)] transition-colors focus:border-[var(--color-signal-500)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
