import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import type { TabId } from '@/types'

// Mirrors the admin app's dashboard.tsx (useDashboardData.ts) and its own
// pending-count queries (production_batches.status, staff.status,
// product_suggestions.status — all confirmed exact column/table names
// against the admin app's cacheRefresh.ts and batchCache.ts/suggestionCache.ts).
// Unlike the mobile app, desktop is not offline-first (CLAUDE.md §6) — there
// is no local SQLite cache, so every figure here is a live Supabase read
// gated on isOnline, and the mobile screen's offline/stale-cache messaging,
// sync-queue counters (pending/failed/conflict), and quick-action CTA cards
// have no desktop equivalent: desktop's Register panel is always visible, so
// there is no separate "New Sale" entry point to link to, and there is no
// local sync_queue/conflict_queue table to report on (see CLAUDE_LOG.md).
interface DashboardData {
  pendingBatches: number
  pendingStaff: number
  pendingSuggestions: number
  unpricedItems: number
  stockCount: number
  salesToday: number
  todayRevenue: number
  invoicesDue: number
}

function formatKes(amount: number): string {
  return `KES ${Number(amount).toLocaleString()}`
}

async function fetchDashboardData(): Promise<DashboardData> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [batchesRes, staffRes, suggestionsRes, salesRes, invoicesRes, unpricedRes, stockRes] =
    await Promise.allSettled([
      supabase
        .from('production_batches')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending_verification', 'pending_product_approval']),
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('product_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('sales').select('net_amount').gte('created_at', todayStart.toISOString()),
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'overdue']),
      supabase.rpc('get_unpriced_items'),
      supabase.rpc('get_all_stock_items')
    ])

  const pendingBatches =
    batchesRes.status === 'fulfilled' && !batchesRes.value.error ? (batchesRes.value.count ?? 0) : 0
  const pendingStaff =
    staffRes.status === 'fulfilled' && !staffRes.value.error ? (staffRes.value.count ?? 0) : 0
  const pendingSuggestions =
    suggestionsRes.status === 'fulfilled' && !suggestionsRes.value.error
      ? (suggestionsRes.value.count ?? 0)
      : 0

  let salesToday = 0
  let todayRevenue = 0
  if (salesRes.status === 'fulfilled' && !salesRes.value.error) {
    const rows = (salesRes.value.data ?? []) as Array<{ net_amount: number }>
    salesToday = rows.length
    todayRevenue = rows.reduce((sum, r) => sum + (Number(r.net_amount) || 0), 0)
  }

  const invoicesDue =
    invoicesRes.status === 'fulfilled' && !invoicesRes.value.error
      ? (invoicesRes.value.count ?? 0)
      : 0

  // get_unpriced_items is RETURNS TABLE — Supabase delivers a plain array,
  // not a { items } wrapper (confirmed against the admin app's useDashboardData.ts).
  const unpricedItems =
    unpricedRes.status === 'fulfilled' && Array.isArray(unpricedRes.value.data)
      ? unpricedRes.value.data.length
      : 0

  const stockCount =
    stockRes.status === 'fulfilled' && Array.isArray(stockRes.value.data)
      ? stockRes.value.data.length
      : 0

  return {
    pendingBatches,
    pendingStaff,
    pendingSuggestions,
    unpricedItems,
    stockCount,
    salesToday,
    todayRevenue,
    invoicesDue
  }
}

interface StatCardProps {
  value: string
  label: string
  onClick?: () => void
}

function StatCard({ value, label, onClick }: StatCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex-1 rounded-md border border-jokenia-tan/20 bg-white/60 px-4 py-3 text-left transition-colors hover:bg-white disabled:cursor-default disabled:hover:bg-white/60"
    >
      <p className="font-heading text-2xl font-semibold text-jokenia-dark">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-jokenia-tan">{label}</p>
    </button>
  )
}

interface ActionRowProps {
  count: number
  label: string
  onClick: () => void
}

function ActionRow({ count, label, onClick }: ActionRowProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-md border border-jokenia-gold/30 bg-jokenia-gold/10 px-3 py-2.5 text-left transition-colors hover:bg-jokenia-gold/20"
    >
      <span className="text-sm font-medium text-jokenia-dark">{label}</span>
      <span className="rounded-full bg-jokenia-gold px-2 py-0.5 text-xs font-semibold text-jokenia-dark">
        {count}
      </span>
    </button>
  )
}

function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const isOnline = useAppStore((state) => state.isOnline)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    enabled: isOnline
  })

  function goTo(tab: TabId, path: string): void {
    setActiveTab(tab)
    navigate(path)
  }

  const hasPendingActions =
    !!data &&
    data.pendingBatches + data.pendingStaff + data.pendingSuggestions + data.unpricedItems > 0

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold text-jokenia-dark">Dashboard</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={!isOnline || isFetching}
          className="text-xs font-medium text-jokenia-tan hover:text-jokenia-dark disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {!isOnline && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          Dashboard requires a live connection to Supabase.
        </p>
      )}

      {isOnline && error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {(error as Error).message}
        </p>
      )}

      {isOnline && isLoading && <p className="text-sm text-jokenia-tan">Loading…</p>}

      {isOnline && data && (
        <>
          <section className="rounded-md border border-jokenia-tan/20 bg-white/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Today&apos;s Revenue
            </p>
            <p className="font-heading text-3xl font-bold text-jokenia-dark">
              {data.todayRevenue > 0 ? formatKes(data.todayRevenue) : 'KES —'}
            </p>
            {data.salesToday > 0 && (
              <p className="text-xs text-jokenia-tan">
                {data.salesToday} transaction{data.salesToday !== 1 ? 's' : ''} today
              </p>
            )}
          </section>

          {hasPendingActions && (
            <section className="flex flex-col gap-2">
              <h2 className="font-heading text-sm font-semibold text-jokenia-dark">
                Pending Actions
              </h2>
              {data.pendingBatches > 0 && (
                <ActionRow
                  count={data.pendingBatches}
                  label="Batches awaiting verification"
                  onClick={() => goTo('batches', '/batches')}
                />
              )}
              {data.pendingStaff > 0 && (
                <ActionRow
                  count={data.pendingStaff}
                  label="Staff awaiting approval"
                  onClick={() => goTo('staff', '/staff')}
                />
              )}
              {data.pendingSuggestions > 0 && (
                <ActionRow
                  count={data.pendingSuggestions}
                  label="Product suggestions to review"
                  onClick={() => goTo('batches', '/batches')}
                />
              )}
              {data.unpricedItems > 0 && (
                <ActionRow
                  count={data.unpricedItems}
                  label="Items need pricing"
                  onClick={() => goTo('inventory', '/inventory')}
                />
              )}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-semibold text-jokenia-dark">Summary</h2>
            <div className="flex gap-3">
              <StatCard
                value={data.stockCount.toLocaleString()}
                label="Items in stock"
                onClick={() => goTo('inventory', '/inventory')}
              />
              <StatCard
                value={data.salesToday > 0 ? String(data.salesToday) : '—'}
                label="Sales today"
                onClick={() => goTo('checkout', '/')}
              />
              <StatCard
                value={data.invoicesDue > 0 ? String(data.invoicesDue) : '—'}
                label="Invoices due"
                onClick={() => goTo('checkout', '/')}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default DashboardPage
