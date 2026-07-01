import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { rpcWithFallback } from '@/lib/rpcWithFallback'
import { pickField } from '@/utils/pickField'
import QueryState from '@/components/ui/QueryState'

// `get_staff_profiles` name and shape are unverified — Desktop App sessions
// do not connect to the Jokenia backend to confirm live RPCs (see
// CLAUDE_OPS.md). Falls back to a direct profiles/device_sessions read
// (select `*`, fields picked defensively) if the RPC doesn't exist. "Active"
// is inferred from having a registered device session, since profiles has no
// documented status column.
interface StaffRow {
  id: string
  staff_code: string | null
  full_name: string
  role: string
  is_active: boolean
}

async function fetchStaff(): Promise<StaffRow[]> {
  return rpcWithFallback<StaffRow[]>('get_staff_profiles', async () => {
    const [profilesResult, sessionsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'staff'),
      supabase.from('device_sessions').select('*')
    ])
    if (profilesResult.error) throw profilesResult.error
    if (sessionsResult.error) throw sessionsResult.error

    const activeUserIds = new Set(
      (sessionsResult.data ?? [])
        .map((row) => pickField<string | null>(row, ['user_id', 'profile_id'], null))
        .filter((id): id is string => id !== null)
    )

    return (profilesResult.data ?? []).map((row) => {
      const id = pickField<string>(row, ['id'], '')
      return {
        id,
        staff_code: pickField<string | null>(row, ['staff_code'], null),
        full_name: pickField<string>(row, ['full_name', 'display_name'], id),
        role: pickField<string>(row, ['role'], 'staff'),
        is_active: activeUserIds.has(id)
      }
    })
  })
}

function StaffPage(): React.JSX.Element {
  const {
    data: staff,
    isLoading,
    error,
    refetch
  } = useQuery({ queryKey: ['staff'], queryFn: fetchStaff })

  return (
    <div className="flex h-full flex-col p-4">
      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={(staff?.length ?? 0) === 0}
        emptyText="No staff profiles found."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Staff code</th>
                <th className="px-3 py-2 font-medium">Full name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff?.map((person) => (
                <tr key={person.id} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {person.staff_code ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{person.full_name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-jokenia-gold px-2 py-0.5 text-xs font-medium text-jokenia-dark">
                      {person.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        person.is_active ? 'bg-green-600 text-white' : 'bg-jokenia-tan text-white'
                      }`}
                    >
                      {person.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}

export default StaffPage
