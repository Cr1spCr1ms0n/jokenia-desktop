import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { rpcWithFallback } from '@/lib/rpcWithFallback'
import { pickField } from '@/utils/pickField'
import QueryState from '@/components/ui/QueryState'

// `get_business_clients` name and shape are unverified — Desktop App sessions
// do not connect to the Jokenia backend to confirm live RPCs (see
// CLAUDE_OPS.md). Falls back to a direct business_clients read (select `*`,
// fields picked defensively) if the RPC doesn't exist.
interface ConsigneeRow {
  id: string
  client_code: string
  name: string
  agreement_type: string | null
  is_active: boolean
}

async function fetchConsignees(): Promise<ConsigneeRow[]> {
  return rpcWithFallback<ConsigneeRow[]>('get_business_clients', async () => {
    const { data, error } = await supabase.from('business_clients').select('*')
    if (error) throw error

    return (data ?? []).map((row) => {
      const clientSeq = pickField<number | string | null>(row, ['client_seq'], null)
      return {
        id: pickField<string>(row, ['id'], ''),
        client_code:
          clientSeq != null
            ? `C${String(clientSeq).padStart(3, '0')}`
            : pickField<string>(row, ['client_code'], '—'),
        name: pickField<string>(row, ['name', 'business_name'], 'Unnamed client'),
        agreement_type: pickField<string | null>(row, ['agreement_type'], null),
        is_active: pickField<boolean>(row, ['is_active'], true)
      }
    })
  })
}

function ConsigneesPage(): React.JSX.Element {
  const {
    data: consignees,
    isLoading,
    error,
    refetch
  } = useQuery({ queryKey: ['consignees'], queryFn: fetchConsignees })

  return (
    <div className="flex h-full flex-col p-4">
      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={(consignees?.length ?? 0) === 0}
        emptyText="No consignees found."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Agreement</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {consignees?.map((consignee) => (
                <tr key={consignee.id} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {consignee.client_code}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{consignee.name}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {consignee.agreement_type ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        consignee.is_active ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {consignee.is_active ? 'Active' : 'Inactive'}
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

export default ConsigneesPage
