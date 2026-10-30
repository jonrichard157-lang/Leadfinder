'use client'

import { useState, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
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

interface NumberInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
}

/**
 * Campo de número inteiro. Um <input type="number"> controlado por um número mantém o
 * zero à esquerda ("05"), porque o React considera "05" igual a 5 e não corrige o texto.
 */
export function NumberInput({ value, onValueChange, min = 0, max, onFocus, onBlur, ...props }: NumberInputProps) {
  const [text, setText] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)

  // O valor mudou por fora (ex.: formulário recarregado): mostra o novo número.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(String(value))
  }

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    let next = digits === '' ? min : Number(digits)
    if (max !== undefined && next > max) next = max
    setText(digits === '' ? '' : String(next))
    setSyncedValue(next)
    onValueChange(next)
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={(e) => {
        e.target.select()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setText(String(value))
        onBlur?.(e)
      }}
      {...props}
    />
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
