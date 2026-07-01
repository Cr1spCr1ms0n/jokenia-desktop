import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { rpcWithFallback } from '@/lib/rpcWithFallback'
import { pickField } from '@/utils/pickField'
import QueryState from '@/components/ui/QueryState'

// `get_expenses` name and shape are unverified — Desktop App sessions do not
// connect to the Jokenia backend to confirm live RPCs (see CLAUDE_OPS.md).
// Falls back to a direct expenses read (select `*`, fields picked
// defensively) if the RPC doesn't exist. This page is only reachable by
// super_admin (gated in TabNav/AppShell already).
interface ExpenseRow {
  id: string
  expense_date: string
  category: string
  amount: number
  description: string | null
}

async function fetchExpenses(): Promise<ExpenseRow[]> {
  return rpcWithFallback<ExpenseRow[]>('get_expenses', async () => {
    const { data, error } = await supabase.from('expenses').select('*')
    if (error) throw error

    return (data ?? []).map((row) => ({
      id: pickField<string>(row, ['id'], ''),
      expense_date: pickField<string>(row, ['expense_date', 'date', 'created_at'], new Date().toISOString()),
      category: pickField<string>(row, ['category'], 'Uncategorized'),
      amount: pickField<number>(row, ['amount'], 0),
      description: pickField<string | null>(row, ['description'], null)
    }))
  })
}

function ExpensesPage(): React.JSX.Element {
  const [month, setMonth] = useState('')
  const {
    data: expenses,
    isLoading,
    error,
    refetch
  } = useQuery({ queryKey: ['expenses'], queryFn: fetchExpenses })

  const filteredExpenses = useMemo(() => {
    if (!month) return expenses ?? []
    return (expenses ?? []).filter((expense) => expense.expense_date.startsWith(month))
  }, [expenses, month])

  const total = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
        />
        <p className="font-heading text-lg text-jokenia-dark">
          Total: KES {total.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
        </p>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filteredExpenses.length === 0}
        emptyText="No expenses found for this period."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {new Date(expense.expense_date).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{expense.category}</td>
                  <td className="px-3 py-2 text-jokenia-dark">
                    KES {expense.amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">{expense.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}

export default ExpensesPage
