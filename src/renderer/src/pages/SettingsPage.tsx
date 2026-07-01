import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'

function SettingsPage(): React.JSX.Element {
  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut()
    // onAuthStateChange in App.tsx handles the redirect to Login automatically
  }

  return (
    <div className="max-w-md p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-jokenia-dark">Settings</h1>
      <p className="mb-8 text-xs text-jokenia-tan">Admin management and session controls.</p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-jokenia-dark">Session</h2>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign out
        </Button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-jokenia-dark">Admin management</h2>
        <p className="text-xs text-jokenia-tan">
          Admin registration and deactivation — coming in a future update.
        </p>
      </section>
    </div>
  )
}

export default SettingsPage
