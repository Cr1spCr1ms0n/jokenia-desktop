import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import type { StaffRow, StaffStatus } from './types'

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected', 'Deactivated'] as const
type Filter = (typeof FILTERS)[number]

interface StaffJoinRow {
  id: string
  staff_code: string | null
  status: StaffStatus
  created_at: string
  profiles: { full_name: string; role: string } | null
}

// The `staff` table has two FKs to `profiles` (staff.id and staff.approved_by)
// — `profiles!staff_id_fkey` disambiguates, matching the admin app's own
// StaffDetailScreen cache-refresh query exactly.
async function fetchStaff(): Promise<StaffRow[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, staff_code, status, created_at, profiles!staff_id_fkey(full_name, role)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as StaffJoinRow[]).map((row) => ({
    id: row.id,
    staff_code: row.staff_code,
    status: row.status,
    created_at: row.created_at,
    full_name: row.profiles?.full_name ?? 'Unknown',
    role: row.profiles?.role ?? 'staff'
  }))
}

function statusBadgeClasses(status: StaffStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-500 text-white'
    case 'approved':
      return 'bg-green-600 text-white'
    case 'rejected':
      return 'bg-red-500 text-white'
    case 'deactivated':
      return 'bg-jokenia-tan text-white'
  }
}

interface StaffListProps {
  onSelect: (staffId: string) => void
}

function StaffList({ onSelect }: StaffListProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('Pending')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff
  })

  const staff = data ?? []
  const filtered = filter === 'All' ? staff : staff.filter((s) => s.status === filter.toLowerCase())

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? 'bg-jokenia-dark text-jokenia-gold'
                : 'border border-jokenia-tan/30 bg-white/70 text-jokenia-dark2'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filtered.length === 0}
        emptyText={`No ${filter.toLowerCase()} staff.`}
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
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => onSelect(member.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {member.staff_code ?? 'Not yet assigned'}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{member.full_name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-jokenia-gold px-2 py-0.5 text-xs font-medium text-jokenia-dark">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(member.status)}`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-jokenia-tan">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}

export default StaffList
