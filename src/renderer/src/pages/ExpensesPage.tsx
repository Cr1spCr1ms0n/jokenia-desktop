import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import QueryState from '@/components/ui/QueryState'

// RPC/table shapes confirmed against the admin app's rpcs.ts / types/rpc.ts /
// types/supabase.ts (finance/expenses.tsx) — no `get_expenses` RPC exists,
// the admin app's own "recent expenses" section reads the `expenses` table
// directly, matched here.
export type ExpenseCategory =
  'raw_materials' | 'rent_utilities' | 'staff_salaries' | 'other_fixed_overhead'

const CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'rent_utilities', label: 'Rent & Utilities' },
  { value: 'staff_salaries', label: 'Staff Salaries' },
  { value: 'other_fixed_overhead', label: 'Other Overhead' }
]

function categoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category.replace(/_/g, ' ')
}

interface DueRecurringExpense {
  template_id: string
  category: ExpenseCategory
  description: string
  default_amount: number | null
  last_recorded_date: string | null
  months_overdue: number
}

interface ExpenseTemplateRow {
  id: string
  category: ExpenseCategory
  description: string
  default_amount: number | null
  is_active: boolean
}

interface ExpenseRow {
  id: string
  expense_date: string
  category: ExpenseCategory
  amount: number
  description: string
  reference_number: string | null
}

async function fetchDueExpenses(): Promise<DueRecurringExpense[]> {
  const { data, error } = await supabase.rpc('get_due_recurring_expenses')
  if (error) throw error
  return (data as DueRecurringExpense[]) ?? []
}

async function fetchTemplates(): Promise<ExpenseTemplateRow[]> {
  const { data, error } = await supabase
    .from('expense_templates')
    .select('id, category, description, default_amount, is_active')
    .order('description')
  if (error) throw error
  return (data as ExpenseTemplateRow[]) ?? []
}

async function fetchExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, expense_date, category, amount, description, reference_number')
    .order('expense_date', { ascending: false })
  if (error) throw error
  return (data as ExpenseRow[]) ?? []
}

interface RecordExpenseParams {
  p_amount: number
  p_expense_date: string
  p_category?: ExpenseCategory | null
  p_description?: string | null
  p_template_id?: string | null
  p_reference_number?: string | null
}

async function recordExpense(params: RecordExpenseParams): Promise<void> {
  const { error } = await supabase.rpc('record_expense', params)
  if (error) throw error
}

interface CreateTemplateParams {
  p_category: ExpenseCategory
  p_description: string
  p_default_amount: number | null
}

async function createTemplate(params: CreateTemplateParams): Promise<void> {
  const { error } = await supabase.rpc('create_expense_template', params)
  if (error) throw error
}

async function deactivateTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('deactivate_expense_template', { p_template_id: templateId })
  if (error) throw error
}

const today = (): string => new Date().toISOString().slice(0, 10)

function ExpensesPage(): React.JSX.Element {
  const isOnline = useAppStore((state) => state.isOnline)
  const queryClient = useQueryClient()

  const dueQuery = useQuery({ queryKey: ['due-expenses'], queryFn: fetchDueExpenses })
  const templatesQuery = useQuery({ queryKey: ['expense-templates'], queryFn: fetchTemplates })
  const expensesQuery = useQuery({ queryKey: ['expenses'], queryFn: fetchExpenses })

  // Record one-time expense form
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(today())
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [description, setDescription] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // New template modal
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateCategory, setTemplateCategory] = useState<ExpenseCategory | null>(null)
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateDefaultAmount, setTemplateDefaultAmount] = useState('')
  const [templateFormError, setTemplateFormError] = useState<string | null>(null)

  // Deactivate confirm modal
  const [deactivateTarget, setDeactivateTarget] = useState<ExpenseTemplateRow | null>(null)

  // Recent expenses filter
  const [month, setMonth] = useState('')

  const recordMutation = useMutation({
    mutationFn: recordExpense,
    onSuccess: () => {
      setAmount('')
      setExpenseDate(today())
      setCategory(null)
      setDescription('')
      setReferenceNumber('')
      setShowForm(false)
      void queryClient.invalidateQueries({ queryKey: ['due-expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  const recordDueMutation = useMutation({
    mutationFn: (due: DueRecurringExpense) =>
      recordExpense({
        p_amount: due.default_amount as number,
        p_expense_date: today(),
        p_category: due.category,
        p_description: due.description,
        p_template_id: due.template_id
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['due-expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    }
  })

  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      setTemplateCategory(null)
      setTemplateDescription('')
      setTemplateDefaultAmount('')
      setShowNewTemplate(false)
      void queryClient.invalidateQueries({ queryKey: ['expense-templates'] })
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateTemplate,
    onSuccess: () => {
      setDeactivateTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['expense-templates'] })
      void queryClient.invalidateQueries({ queryKey: ['due-expenses'] })
    }
  })

  const filteredExpenses = useMemo(() => {
    const rows = expensesQuery.data ?? []
    if (!month) return rows
    return rows.filter((row) => row.expense_date.startsWith(month))
  }, [expensesQuery.data, month])

  const total = filteredExpenses.reduce((sum, row) => sum + row.amount, 0)

  function handleSubmitExpense(): void {
    if (!isOnline) {
      setFormError('Recording an expense requires an internet connection.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    if (!category) {
      setFormError('Select a category.')
      return
    }
    if (!expenseDate) {
      setFormError('Select an expense date.')
      return
    }
    setFormError(null)
    recordMutation.mutate({
      p_amount: parsedAmount,
      p_expense_date: expenseDate,
      p_category: category,
      p_description: description.trim() || null,
      p_reference_number: referenceNumber.trim() || null
    })
  }

  function handleCreateTemplate(): void {
    if (!isOnline) {
      setTemplateFormError('Creating a template requires an internet connection.')
      return
    }
    if (!templateCategory) {
      setTemplateFormError('Select a category.')
      return
    }
    if (!templateDescription.trim()) {
      setTemplateFormError('Enter a description.')
      return
    }
    setTemplateFormError(null)
    createTemplateMutation.mutate({
      p_category: templateCategory,
      p_description: templateDescription.trim(),
      p_default_amount: templateDefaultAmount ? parseFloat(templateDefaultAmount) : null
    })
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {!isOnline && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          Recording expenses requires an internet connection.
        </p>
      )}

      {(dueQuery.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg text-jokenia-dark">
            Overdue Recurring ({dueQuery.data!.length})
          </h2>
          {dueQuery.data!.map((due) => (
            <div
              key={due.template_id}
              className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-jokenia-dark">{due.description}</p>
                <p className="text-xs text-jokenia-tan">
                  {categoryLabel(due.category)} · {due.months_overdue} month
                  {due.months_overdue > 1 ? 's' : ''} overdue
                </p>
                {due.default_amount ? (
                  <p className="text-sm font-semibold text-jokenia-dark2">
                    KES {due.default_amount.toLocaleString('en-KE')}
                  </p>
                ) : (
                  <p className="text-[11px] text-jokenia-tan">
                    No default amount — use the form below and pick this template&apos;s category.
                  </p>
                )}
              </div>
              <Button
                onClick={() => recordDueMutation.mutate(due)}
                disabled={!isOnline || !due.default_amount || recordDueMutation.isPending}
              >
                {recordDueMutation.isPending ? 'Recording…' : 'Record Now'}
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-jokenia-tan/20 pt-6 first:border-t-0 first:pt-0">
        <h2 className="font-heading text-lg text-jokenia-dark">Record Expense</h2>

        {!showForm ? (
          <div>
            <Button onClick={() => setShowForm(true)} disabled={!isOnline}>
              + Record One-Time Expense
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  Amount (KES)
                </p>
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  Expense Date
                </p>
                <input
                  type="date"
                  value={expenseDate}
                  max={today()}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      category === cat.value
                        ? 'bg-jokenia-gold text-jokenia-dark'
                        : 'bg-white text-jokenia-dark2 hover:bg-jokenia-cream2'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Description
              </p>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What was this expense for?"
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
              />
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Reference Number (optional)
              </p>
              <input
                type="text"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Invoice or receipt number"
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
              />
            </div>

            {(formError || recordMutation.error) && (
              <p className="text-xs text-red-600">
                {formError ?? (recordMutation.error as Error).message}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setFormError(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitExpense}
                disabled={recordMutation.isPending || !isOnline}
                className="flex-1"
              >
                {recordMutation.isPending ? 'Submitting…' : 'Submit Expense'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-jokenia-tan/20 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-jokenia-dark">Expense Templates</h2>
          <Button variant="secondary" onClick={() => setShowNewTemplate(true)} disabled={!isOnline}>
            + New Template
          </Button>
        </div>

        <QueryState
          isLoading={templatesQuery.isLoading}
          error={templatesQuery.error as Error | null}
          isEmpty={(templatesQuery.data ?? []).length === 0}
          emptyText="No recurring expense templates yet."
          onRetry={templatesQuery.refetch}
        >
          <div className="flex flex-col gap-2">
            {(templatesQuery.data ?? []).map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center justify-between gap-3 rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-jokenia-dark">{tmpl.description}</p>
                  <p className="text-xs text-jokenia-tan">
                    {categoryLabel(tmpl.category)}
                    {tmpl.default_amount
                      ? ` · KES ${tmpl.default_amount.toLocaleString('en-KE')}`
                      : ''}
                    {!tmpl.is_active ? ' · Inactive' : ''}
                  </p>
                </div>
                {tmpl.is_active && (
                  <Button
                    variant="ghost"
                    onClick={() => setDeactivateTarget(tmpl)}
                    disabled={!isOnline}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            ))}
          </div>
        </QueryState>
      </section>

      <section className="flex flex-col gap-3 border-t border-jokenia-tan/20 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-jokenia-dark">Recent Expenses</h2>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
            />
            <p className="font-heading text-base text-jokenia-dark">
              Total: KES {total.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <QueryState
          isLoading={expensesQuery.isLoading}
          error={expensesQuery.error as Error | null}
          isEmpty={filteredExpenses.length === 0}
          emptyText="No expenses found for this period."
          onRetry={expensesQuery.refetch}
        >
          <div className="overflow-y-auto rounded-md border border-jokenia-tan/20">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-jokenia-cream2">
                <tr className="text-jokenia-dark2">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-jokenia-tan/10">
                    <td className="px-3 py-2 text-jokenia-dark2">
                      {new Date(expense.expense_date).toLocaleDateString('en-KE')}
                    </td>
                    <td className="px-3 py-2 text-jokenia-dark">
                      {categoryLabel(expense.category)}
                    </td>
                    <td className="px-3 py-2 text-jokenia-dark">
                      KES {expense.amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 text-jokenia-dark2">{expense.description}</td>
                    <td className="px-3 py-2 text-jokenia-dark2">
                      {expense.reference_number ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </section>

      <Modal
        title="New expense template"
        isOpen={showNewTemplate}
        onClose={() => {
          setShowNewTemplate(false)
          setTemplateFormError(null)
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Category
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setTemplateCategory(cat.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    templateCategory === cat.value
                      ? 'bg-jokenia-gold text-jokenia-dark'
                      : 'bg-white text-jokenia-dark2 hover:bg-jokenia-cream2'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Description
            </p>
            <input
              type="text"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder="e.g. Shop rent"
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Default Amount (optional)
            </p>
            <input
              type="number"
              value={templateDefaultAmount}
              onChange={(event) => setTemplateDefaultAmount(event.target.value)}
              placeholder="KES"
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
          </div>

          {(templateFormError || createTemplateMutation.error) && (
            <p className="text-xs text-red-600">
              {templateFormError ?? (createTemplateMutation.error as Error).message}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowNewTemplate(false)
                setTemplateFormError(null)
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={createTemplateMutation.isPending || !isOnline}
              className="flex-1"
            >
              {createTemplateMutation.isPending ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Deactivate template"
        isOpen={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-jokenia-dark">
            Deactivate &quot;{deactivateTarget?.description}&quot;? It will no longer appear under
            overdue recurring expenses.
          </p>
          {deactivateMutation.error && (
            <p className="text-xs text-red-600">{(deactivateMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeactivateTarget(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
              disabled={deactivateMutation.isPending || !isOnline}
              className="flex-1"
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ExpensesPage
