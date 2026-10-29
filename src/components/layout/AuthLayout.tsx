import type { ReactNode } from 'react'
import Link from 'next/link'
import { Orbit, GlobeLock, Gauge, Bookmark } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

const SELLING_POINTS = [
  { icon: GlobeLock, text: 'Encontre empresas sem website na sua região' },
  { icon: Gauge, text: 'Priorize com o Opportunity Score' },
  { icon: Bookmark, text: 'Organize seus leads em um só lugar' },
]

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-signal-600)] text-white">
              <Orbit size={18} />
            </div>
            <span className="font-display text-lg font-semibold text-[var(--color-ink-900)]">
              OrbeLead
            </span>
          </Link>

          <h1 className="mt-8 font-display text-2xl font-semibold text-[var(--color-ink-900)]">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-600)]">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-[var(--color-ink-600)]">{footer}</div>}
        </div>
      </div>

      <div className="hidden flex-col justify-center bg-[var(--color-ink-900)] px-16 md:flex">
        <p className="font-display text-2xl font-medium leading-snug text-white text-balance">
          “Em duas semanas encontrei 30 leads qualificados sem gastar nada com anúncios.”
        </p>
        <p className="mt-3 text-sm text-[var(--color-ink-300)]">— Time de prospecção, agência parceira</p>

        <div className="mt-12 space-y-4">
          {SELLING_POINTS.map((point) => (
            <div key={point.text} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                <point.icon size={16} />
              </div>
              <span className="text-sm text-[var(--color-ink-100)]">{point.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
