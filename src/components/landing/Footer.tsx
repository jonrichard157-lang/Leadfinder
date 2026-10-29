import Link from 'next/link'
import { Orbit } from 'lucide-react'

const COLUMNS = [
  {
    title: 'Produto',
    links: [
      { label: 'Como funciona', href: '#como-funciona' },
      { label: 'Funcionalidades', href: '#funcionalidades' },
      { label: 'Preços', href: '#precos' },
    ],
  },
  {
    title: 'Conta',
    links: [
      { label: 'Entrar', href: '/login' },
      { label: 'Criar conta', href: '/cadastro' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Termos de uso', href: '#' },
      { label: 'Privacidade', href: '#' },
      { label: 'Contato', href: '#' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-ink-100)] bg-white py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-signal-600)] text-white">
                <Orbit size={16} />
              </div>
              <span className="font-display text-base font-semibold text-[var(--color-ink-900)]">
                OrbeLead
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-[var(--color-ink-500)]">
              Prospecção comercial para freelancers, desenvolvedores e agências digitais.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">{col.title}</p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link href={link.href} className="text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--color-ink-100)] pt-6">
          <p className="text-xs text-[var(--color-ink-400)]">
            © 2026 OrbeLead. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
