'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[var(--color-signal-600)] text-white hover:bg-[var(--color-signal-700)] shadow-sm',
  secondary:
    'bg-white text-[var(--color-ink-800)] border border-[var(--color-ink-200)] hover:border-[var(--color-ink-400)] hover:bg-[var(--color-ink-50)]',
  ghost:
    'bg-transparent text-[var(--color-ink-700)] hover:bg-[var(--color-ink-100)]',
  danger:
    'bg-white text-[var(--color-red-600)] border border-[var(--color-red-100)] hover:bg-[var(--color-red-100)]',
}

const sizeStyles: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-md gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-lg gap-2',
  lg: 'text-base px-6 py-3 rounded-lg gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
