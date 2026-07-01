import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { rpcWithFallback } from '@/lib/rpcWithFallback'
import { pickField } from '@/utils/pickField'
import QueryState from '@/components/ui/QueryState'

// `get_partners` verified live: does not exist. A `partners` table does
// exist (id, partner_seq, partner_code, name, contact_person, phone, email,
// address, is_active, created_by, created_at) — no bulk list RPC, only
// per-partner ones (get_partner_stock_items, get_daily_partner_dispatches
// etc.), which aren't practical to call per-row here. Falls back to a direct
// partners read; stock_count/last_dispatch_at stay null (already rendered
// as "—") since those require the per-partner RPCs.
interface PartnerRow {
  id: string
  name: string
  stock_count: number | null
  last_dispatch_at: string | null
}

async function fetchPartners(): Promise<PartnerRow[]> {
  return rpcWithFallback<PartnerRow[]>('get_partners', async () => {
    const { data, error } = await supabase.from('partners').select('*')
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: pickField<string>(row, ['id'], ''),
      name: pickField<string>(row, ['name'], 'Unnamed partner'),
      stock_count: null,
      last_dispatch_at: null
    }))
  })
}

function PartnersPage(): React.JSX.Element {
  const {
    data: partners,
    isLoading,
    error,
    refetch
  } = useQuery({ queryKey: ['partners'], queryFn: fetchPartners })

  return (
    <div className="flex h-full flex-col p-4">
      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={(partners?.length ?? 0) === 0}
        emptyText="No partner data found."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Partner</th>
                <th className="px-3 py-2 font-medium">Stock at partner</th>
                <th className="px-3 py-2 font-medium">Last dispatch</th>
              </tr>
            </thead>
            <tbody>
              {partners?.map((partner) => (
                <tr key={partner.id} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2 text-jokenia-dark">{partner.name}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{partner.stock_count ?? '—'}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {partner.last_dispatch_at
                      ? new Date(partner.last_dispatch_at).toLocaleDateString('en-KE')
                      : '—'}
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

export default PartnersPage
