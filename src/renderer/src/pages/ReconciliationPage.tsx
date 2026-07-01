import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'

// `reconcile_inventory`'s exact return shape is unverified — Desktop App
// sessions do not connect to the Jokenia backend to confirm live RPCs (see
// CLAUDE_OPS.md). Assumed to return one row per discrepancy found.
interface ReconciliationIssue {
  issue_type: string
  detail: string
  item_serial: string | null
}

async function runReconciliation(): Promise<ReconciliationIssue[]> {
  const { data, error } = await supabase.rpc('reconcile_inventory')
  if (error) throw error
  return (data as ReconciliationIssue[]) ?? []
}

function ReconciliationPage(): React.JSX.Element {
  const mutation = useMutation({ mutationFn: runReconciliation })

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3">
        <Button variant="primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Running…' : 'Run reconciliation'}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-jokenia-tan">Checking inventory for discrepancies…</p>
        </div>
      )}

      {mutation.isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-jokenia-tan">{(mutation.error as Error).message}</p>
          <Button variant="secondary" onClick={() => mutation.mutate()}>
            Retry
          </Button>
        </div>
      )}

      {mutation.isSuccess && mutation.data.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-jokenia-tan">No discrepancies found.</p>
        </div>
      )}

      {mutation.isSuccess && mutation.data.length > 0 && (
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium">Detail</th>
                <th className="px-3 py-2 font-medium">Item serial</th>
              </tr>
            </thead>
            <tbody>
              {mutation.data.map((issue, index) => (
                <tr key={index} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                      {issue.issue_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{issue.detail}</td>
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {issue.item_serial ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ReconciliationPage
