import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import type { PartnerRow } from './types'

type FilterType = 'all' | 'active' | 'inactive'

// `get_partners` confirmed NOT to exist live (Session 8) — the `partners`
// table does exist and is queried directly here, matching the admin app's
// own `fetchPartners()` (direct table read, no RPC).
async function fetchPartners(): Promise<PartnerRow[]> {
  const { data, error } = await supabase
    .from('partners')
    .select('id, partner_code, name, contact_person, phone, email, is_active')
    .order('partner_code')
  if (error) throw error
  return (data ?? []) as PartnerRow[]
}

interface PartnerListProps {
  onSelect: (partnerId: string) => void
  onRegister: () => void
}

function PartnerList({ onSelect, onRegister }: PartnerListProps): React.JSX.Element {
  const [filter, setFilter] = useState<FilterType>('all')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['partners'],
    queryFn: fetchPartners
  })

  const partners = data ?? []
  const filtered = partners.filter((p) => {
    if (filter === 'active') return p.is_active
    if (filter === 'inactive') return !p.is_active
    return true
  })

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button onClick={onRegister}>+ Register Partner</Button>
        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as FilterType[]).map((f) => (
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
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filtered.length === 0}
        emptyText={
          filter === 'all' ? 'No partners registered — register the first one.' : `No ${filter} partners.`
        }
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => (
                <tr
                  key={partner.id}
                  onClick={() => onSelect(partner.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">{partner.partner_code}</td>
                  <td className="px-3 py-2 text-jokenia-dark">{partner.name}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{partner.phone ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        partner.is_active ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {partner.is_active ? 'Active' : 'Inactive'}
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

export default PartnerList
