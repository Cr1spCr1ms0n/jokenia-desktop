import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import type { ConsigneeRow } from './types'

async function fetchConsignees(): Promise<ConsigneeRow[]> {
  const { data, error } = await supabase
    .from('business_clients')
    .select('id, name, client_seq, is_active')
    .order('name')
  if (error) throw error
  return (data ?? []) as ConsigneeRow[]
}

interface ConsigneeListProps {
  onSelect: (clientId: string) => void
  onRegister: () => void
}

function ConsigneeList({ onSelect, onRegister }: ConsigneeListProps): React.JSX.Element {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['consignees'],
    queryFn: fetchConsignees
  })

  const consignees = data ?? []

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex justify-end">
        <Button onClick={onRegister}>+ Register Consignee</Button>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={consignees.length === 0}
        emptyText="No consignees registered — register the first one."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {consignees.map((consignee) => (
                <tr
                  key={consignee.id}
                  onClick={() => onSelect(consignee.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    C{String(consignee.client_seq).padStart(3, '0')}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{consignee.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        consignee.is_active ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {consignee.is_active ? 'Active' : 'Inactive'}
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

export default ConsigneeList
