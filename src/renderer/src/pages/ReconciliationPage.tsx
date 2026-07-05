import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import { useAppStore } from '@/store/appStore'

// Exact shapes confirmed against the admin app's rpc.ts (ReconcileInventoryIssue /
// ReconcileFinancialsIssue) and rpcs.ts (rpc_reconcile_inventory / rpc_reconcile_financials).
interface ReconcileInventoryIssue {
  issue: string
  item_id: string
  detail: string
}

interface ReconcileFinancialsIssue {
  issue: string
  affected_id: string
}

async function runInventoryReconciliation(): Promise<ReconcileInventoryIssue[]> {
  const { data, error } = await supabase.rpc('reconcile_inventory')
  if (error) throw error
  return (data as ReconcileInventoryIssue[]) ?? []
}

async function runFinancialReconciliation(): Promise<ReconcileFinancialsIssue[]> {
  const { data, error } = await supabase.rpc('reconcile_financials')
  if (error) throw error
  return (data as ReconcileFinancialsIssue[]) ?? []
}

// v3.3: 12 checks (was 7) — matches the admin app's finance/reconciliation.tsx check list verbatim.
const FINANCIAL_CHECKS = [
  '1. Sales missing gross ledger credit',
  '2. Ledger credit ≠ gross_amount',
  '3. Sales with discounts missing discount debits',
  '4. Non-invoiced sales missing payment entries',
  '5. Payment credits ≠ net_amount',
  '6. Returned items missing refund debit',
  '7. Expenses missing ledger debit',
  '8. Consignment sales missing client_liability debit',
  '9. Invoiced sales missing invoice_raised credit',
  '10. Settled invoices missing invoice_settled credit',
  '11. Consignment: owner_revenue + client_liability ≠ net_amount',
  '12. Wholesale sales with discounts (should be zero)'
]

function ReconciliationPage(): React.JSX.Element {
  const isOnline = useAppStore((state) => state.isOnline)

  const invMutation = useMutation({ mutationFn: runInventoryReconciliation })
  const finMutation = useMutation({ mutationFn: runFinancialReconciliation })

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {!isOnline && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          Reconciliation requires a live connection to Supabase.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-jokenia-dark">Inventory Reconciliation</h2>
        <p className="text-xs leading-relaxed text-jokenia-tan">
          Checks for: (1) sold items without a sale record, (2) duplicate serial numbers, (3)
          sale_items referencing non-sold items.
        </p>
        <div>
          <Button
            variant="primary"
            onClick={() => invMutation.mutate()}
            disabled={invMutation.isPending || !isOnline}
          >
            {invMutation.isPending ? 'Running…' : 'Run Inventory Check'}
          </Button>
        </div>

        {invMutation.isError && (
          <p className="text-xs text-red-600">{(invMutation.error as Error).message}</p>
        )}

        {invMutation.isSuccess && invMutation.data.length === 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-sm font-medium text-green-700">✓ No inventory issues found</p>
          </div>
        )}

        {invMutation.isSuccess && invMutation.data.length > 0 && (
          <div className="flex flex-col gap-2">
            {invMutation.data.map((issue, index) => (
              <div key={index} className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs font-semibold text-red-700">{issue.issue}</p>
                <p className="text-xs text-red-600">{issue.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-jokenia-dark2">{issue.item_id}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-jokenia-tan/20 pt-6">
        <h2 className="font-heading text-lg text-jokenia-dark">Financial Reconciliation</h2>
        <p className="text-xs text-jokenia-tan">Runs 12 checks (v3.3):</p>
        <ul className="flex flex-col gap-0.5">
          {FINANCIAL_CHECKS.map((check) => (
            <li key={check} className="text-[11px] leading-relaxed text-jokenia-tan">
              {check}
            </li>
          ))}
        </ul>
        <div>
          <Button
            variant="primary"
            onClick={() => finMutation.mutate()}
            disabled={finMutation.isPending || !isOnline}
          >
            {finMutation.isPending ? 'Running…' : 'Run Financial Check'}
          </Button>
        </div>

        {finMutation.isError && (
          <p className="text-xs text-red-600">{(finMutation.error as Error).message}</p>
        )}

        {finMutation.isSuccess && finMutation.data.length === 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-sm font-medium text-green-700">✓ All 12 financial checks passed</p>
          </div>
        )}

        {finMutation.isSuccess && finMutation.data.length > 0 && (
          <div className="flex flex-col gap-2">
            {finMutation.data.map((issue, index) => (
              <div key={index} className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs font-semibold text-red-700">{issue.issue}</p>
                <p className="mt-1 font-mono text-[11px] text-jokenia-dark2">{issue.affected_id}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ReconciliationPage
