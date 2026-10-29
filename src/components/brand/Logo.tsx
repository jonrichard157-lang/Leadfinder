import { useId } from 'react'
import { cn } from '@/lib/utils'

// Mesma geometria de scripts/brand-assets.mjs (favicon e ícones) — altere os dois juntos.
function Orbit() {
  return (
    <>
      <g transform="rotate(-22 31 37)">
        <path d="M3 37A28 8.5 0 0 0 59 37A28 3.2 0 0 1 3 37Z" />
      </g>
      <circle cx="56.96" cy="26.51" r="4.6" />
    </>
  )
}

/**
 * Símbolo do OrbeLead: "O" (orbe) + órbita (conexão) + ponto (lead).
 * O anel usa `currentColor`; a órbita mantém o gradiente da marca.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  const gradientId = `${id}-g`
  const maskId = `${id}-k`

  return (
    <svg viewBox="2 8 61 46" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="2" y1="48" x2="60" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2F6BF0" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <g fill="#000" stroke="#000" strokeWidth="2.6" strokeLinejoin="round">
            <Orbit />
          </g>
        </mask>
      </defs>
      <ellipse
        cx="28"
        cy="31"
        rx="15"
        ry="17"
        transform="rotate(-12 28 31)"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        mask={`url(#${maskId})`}
      />
      <g fill={`url(#${gradientId})`}>
        <Orbit />
      </g>
    </svg>
  )
}

const SIZES = {
  sm: { mark: 'h-6', text: 'text-base', tagline: 'text-[9px]' },
  md: { mark: 'h-7', text: 'text-xl', tagline: 'text-[10px]' },
  lg: { mark: 'h-10', text: 'text-3xl', tagline: 'text-xs' },
}

interface LogoProps {
  size?: keyof typeof SIZES
  /** `light` para fundos claros (anel navy), `dark` para fundos escuros (anel branco). */
  tone?: 'light' | 'dark'
  tagline?: boolean
  className?: string
}

export function Logo({ size = 'md', tone = 'light', tagline = false, className }: LogoProps) {
  const s = SIZES[size]
  const ink = tone === 'dark' ? 'text-white' : 'text-[var(--color-navy)]'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn(s.mark, 'w-auto shrink-0', ink)} />
      <span className="flex flex-col leading-none">
        <span className={cn('font-brand font-semibold tracking-tight', s.text, ink)}>
          Orbe
          <span className="bg-linear-to-r from-[#2F6BF0] to-[#4F46E5] bg-clip-text text-transparent">Lead</span>
        </span>
        {tagline && (
          <span
            className={cn(
              'mt-1 tracking-[0.18em]',
              s.tagline,
              tone === 'dark' ? 'text-[var(--color-ink-300)]' : 'text-[var(--color-ink-500)]'
            )}
          >
            Mais leads. Mais oportunidades.
          </span>
        )}
      </span>
    </span>
  )
}
