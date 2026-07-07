import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import { useAppStore } from '@/store/appStore'
import type { SystemRole } from '@/types'

interface AccountSectionProps {
  role: SystemRole
  userEmail: string
}

const ROLE_LABEL: Record<SystemRole, string> = {
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin'
}

function AccountSection({ role, userEmail }: AccountSectionProps): React.JSX.Element {
  const clearChannelState = useAppStore((state) => state.clearChannelState)

  async function handleSignOut(): Promise<void> {
    clearChannelState()
    await supabase.auth.signOut()
    // onAuthStateChange in App.tsx handles the redirect to Login automatically
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2.5">
        <p className="text-sm text-jokenia-dark">{userEmail}</p>
        <p className="text-xs text-jokenia-tan">{ROLE_LABEL[role]}</p>
      </div>
      <Button variant="secondary" onClick={() => void handleSignOut()}>
        Sign out
      </Button>

      <div className="pt-2">
        <h3 className="mb-1 text-sm font-medium text-jokenia-dark">Admin management</h3>
        <p className="text-xs text-jokenia-tan">
          Admin registration and deactivation — coming in a future update.
        </p>
      </div>
    </div>
  )
}

export default AccountSection
