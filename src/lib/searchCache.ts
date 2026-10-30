import type { Lead } from '@/types'

// Guarda os resultados das últimas buscas na aba do navegador. Ao voltar da página de
// detalhes, a lista aparece na hora, sem chamar o Google nem gastar a cota de buscas.
const STORAGE_KEY = 'orbelead:searches'
const MAX_ENTRIES = 5

interface CacheEntry {
  key: string
  leads: Lead[]
}

function readAll(): CacheEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CacheEntry[]) : []
  } catch {
    return []
  }
}

export function readSearchCache(key: string): Lead[] | null {
  return readAll().find((e) => e.key === key)?.leads ?? null
}

export function writeSearchCache(key: string, leads: Lead[]) {
  const entries = [{ key, leads }, ...readAll().filter((e) => e.key !== key)].slice(0, MAX_ENTRIES)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Armazenamento cheio ou bloqueado: a busca só não fica guardada.
  }
}
