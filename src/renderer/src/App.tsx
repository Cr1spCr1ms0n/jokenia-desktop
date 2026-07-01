import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { SystemRole } from '@/types'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'

function App(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<SystemRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchRole(data.session.user.id)
      } else {
        setIsLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        fetchRole(nextSession.user.id)
      } else {
        setRole(null)
        setIsLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchRole(userId: string): Promise<void> {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    setRole((data?.role as SystemRole) ?? null)
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-jokenia-dark">
        <span className="font-heading text-lg text-jokenia-gold">JOKENIA</span>
      </div>
    )
  }

  if (!session || !role || role === 'staff') {
    return <LoginPage />
  }

  return <AppShell role={role} userEmail={session.user.email ?? ''} />
}

export default App
