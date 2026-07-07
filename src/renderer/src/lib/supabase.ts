import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Shared shop-PC register: every launch requires a fresh login by design
// (admin vs super_admin authority differs, so a session left logged in on a
// shared machine is a social-engineering risk). persistSession: false makes
// this explicit policy rather than accidental behaviour — see CLAUDE_LOG.md's
// investigation into why sessions weren't actually surviving restarts even
// before this was set. autoRefreshToken stays on: it governs the in-memory
// refresh timer for the lifetime of this client instance, independent of
// persistSession, so mid-session token refresh is unaffected.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true
  }
})
