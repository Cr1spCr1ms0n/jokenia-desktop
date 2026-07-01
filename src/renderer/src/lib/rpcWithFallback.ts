import { supabase } from '@/lib/supabase'

// Calls an RPC by name; if it errors (e.g. the function doesn't exist on the
// backend yet), falls back to a caller-supplied direct query. RPC names in
// Phase 5 module pages are best-effort guesses — Desktop App sessions do not
// connect to the Jokenia backend to confirm live function names (see
// CLAUDE_OPS.md) — so this keeps pages working either way.
export async function rpcWithFallback<T>(rpcName: string, fallback: () => Promise<T>): Promise<T> {
  const { data, error } = await supabase.rpc(rpcName)
  if (!error) return data as T
  return fallback()
}
