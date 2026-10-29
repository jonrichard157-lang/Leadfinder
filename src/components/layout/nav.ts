import { LayoutDashboard, Search, Users, CreditCard, Settings, ShieldCheck } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/buscar', label: 'Buscar Leads', icon: Search },
  { href: '/app/meus-leads', label: 'Meus Leads', icon: Users },
  { href: '/app/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/app/configuracoes', label: 'Configurações', icon: Settings },
]

const TEAM_NAV_ITEM = { href: '/app/equipe', label: 'Equipe', icon: ShieldCheck }

export function getNavItems(isAdmin: boolean) {
  return isAdmin ? [...NAV_ITEMS, TEAM_NAV_ITEM] : NAV_ITEMS
}
