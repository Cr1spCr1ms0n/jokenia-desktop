import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'

function parseReauthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'Current password is incorrect.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('fetch')) {
    return 'Unable to connect. Check your network and try again.'
  }
  if (m.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return message
}

interface ChangePasswordSectionProps {
  userEmail: string
}

function ChangePasswordSection({ userEmail }: ChangePasswordSectionProps): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const newPasswordValid = newPassword.length >= 8
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const sameAsCurrent =
    currentPassword.length > 0 && newPassword.length > 0 && newPassword === currentPassword
  const canSubmit =
    currentPassword.length > 0 && newPasswordValid && passwordsMatch && !sameAsCurrent && !submitting

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword
    })
    if (reauthError) {
      setSubmitting(false)
      setError(parseReauthError(reauthError.message))
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="space-y-3">
      <PasswordField
        label="Current password"
        value={currentPassword}
        onChange={setCurrentPassword}
        visible={showCurrent}
        onToggleVisible={() => setShowCurrent((v) => !v)}
        placeholder="Your current password"
      />

      <PasswordField
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        visible={showNew}
        onToggleVisible={() => setShowNew((v) => !v)}
        placeholder="At least 8 characters"
      />
      {newPassword && !newPasswordValid && (
        <p className="-mt-2 text-xs text-red-600">Password must be at least 8 characters.</p>
      )}
      {sameAsCurrent && (
        <p className="-mt-2 text-xs text-red-600">
          New password must be different from your current password.
        </p>
      )}

      <PasswordField
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showConfirm}
        onToggleVisible={() => setShowConfirm((v) => !v)}
        placeholder="Re-enter new password"
      />
      {confirmPassword && !passwordsMatch && (
        <p className="-mt-2 text-xs text-red-600">Passwords do not match.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
          Password updated successfully.
        </p>
      )}

      <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
        {submitting ? 'Updating…' : 'Update password'}
      </Button>
    </div>
  )
}

export default ChangePasswordSection
