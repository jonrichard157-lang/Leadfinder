'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  {
    question: 'Como o LeadFinder encontra empresas sem website?',
    answer:
      'A plataforma cruza dados de empresas locais e verifica a presença de um website vinculado ao negócio, sinalizando quais estabelecimentos ainda não têm presença digital própria.',
  },
  {
    question: 'Preciso instalar alguma coisa?',
    answer: 'Não. O LeadFinder funciona direto no navegador, em qualquer computador ou celular.',
  },
  {
    question: 'Os dados são atualizados com que frequência?',
    answer:
      'As buscas são feitas sob demanda, então os resultados refletem as informações públicas disponíveis no momento da consulta.',
  },
  {
    question: 'Posso cancelar minha assinatura quando quiser?',
    answer: 'Sim. Você pode cancelar a qualquer momento diretamente na página de Assinatura, sem multas.',
  },
  {
    question: 'O plano grátis expira?',
    answer: 'Não expira. O plano Grátis é permanente, com limite de 10 leads por mês.',
  },
]

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <h2 className="text-balance text-center font-display text-3xl font-semibold text-[var(--color-ink-900)]">
          Perguntas frequentes
        </h2>

        <div className="mt-10 divide-y divide-[var(--color-ink-100)] rounded-xl border border-[var(--color-ink-100)] bg-white">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div key={faq.question}>
                <button
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-[var(--color-ink-900)]">{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={cn(
                      'shrink-0 text-[var(--color-ink-400)] transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="px-6 pb-4 text-sm leading-relaxed text-[var(--color-ink-600)]">
                    {faq.answer}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
