import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

const LAST_EMAIL_KEY = 'login.lastEmail'

function parseAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('fetch')) {
    return 'Unable to connect. Check your network and try again.'
  }
  if (m.includes('invalid login credentials') || m.includes('invalid email or password')) {
    return 'Invalid email or password.'
  }
  if (m.includes('email not confirmed')) {
    return 'Email not confirmed. Contact your administrator.'
  }
  if (m.includes('too many requests')) {
    return 'Too many sign-in attempts. Wait a moment and try again.'
  }
  return message
}

function LoginPage(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Convenience only, never a credential — password is required every
  // launch by design (shared shop-PC register, persistSession: false in
  // lib/supabase.ts). Prefilling the last-used email just saves retyping it.
  useEffect(() => {
    window.electron.getPreference(LAST_EMAIL_KEY).then((value) => {
      if (typeof value === 'string' && value) {
        setEmail(value)
        passwordInputRef.current?.focus()
      }
    })
  }, [])

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      setError(parseAuthError(signInError.message))
      setIsSubmitting(false)
      return
    }

    const userId = data.session?.user.id
    if (!userId) {
      setError('Sign in failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role === 'staff') {
      await supabase.auth.signOut()
      setError('Staff credentials are not permitted on this terminal')
      setIsSubmitting(false)
      return
    }

    void window.electron.setPreference(LAST_EMAIL_KEY, email)
    // Success — App.tsx's onAuthStateChange listener takes over from here.
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-jokenia-dark">
      <form
        onSubmit={handleSubmit}
        className="w-80 rounded-lg bg-jokenia-cream p-8 shadow-lg"
      >
        <div className="mb-1 text-center font-heading text-2xl font-bold text-jokenia-dark">
          JOKENIA
        </div>
        <div className="mb-6 text-center text-xs tracking-wide text-jokenia-tan">
          Operations
        </div>

        <label className="mb-1 block text-xs font-medium text-jokenia-dark2" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-jokenia-sand bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
        />

        <label className="mb-1 block text-xs font-medium text-jokenia-dark2" htmlFor="password">
          Password
        </label>
        <div className="relative mb-4">
          <input
            id="password"
            ref={passwordInputRef}
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-jokenia-sand bg-white px-3 py-2 pr-9 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 cursor-pointer"
            style={{ color: 'rgba(61,61,46,0.45)' }}
          >
            {showPassword ? (
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && <div className="mb-4 text-xs text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-jokenia-gold py-2 text-sm font-semibold text-jokenia-dark disabled:opacity-60"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}

export default LoginPage
