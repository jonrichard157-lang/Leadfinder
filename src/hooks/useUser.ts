'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface UserProfileData {
  id: string
  full_name: string | null
  company: string | null
  plan: 'free' | 'pro' | 'agencia'
  monthly_lead_limit: number
  leads_used_this_month: number
  avatar_url: string | null
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data) {
        setProfile(data as UserProfileData)
      }
    } catch (e) {
      console.error('Erro ao carregar perfil do usuário:', e)
    }
  }, [])

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        setUser(currentUser)
        if (currentUser) {
          await fetchProfile(currentUser.id)
        }
      } catch (err) {
        console.error('Erro ao carregar autenticação:', err)
      } finally {
        setLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await fetchProfile(authUser.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Gera as iniciais do nome para o avatar (ex: "Rafael Martins" -> "RM")
  const initials = (profile?.full_name || user?.user_metadata?.full_name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('')

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'

  return {
    user,
    profile,
    displayName,
    initials,
    loading,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id),
  }
}

