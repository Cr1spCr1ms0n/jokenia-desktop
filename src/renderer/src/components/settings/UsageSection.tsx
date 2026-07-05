import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import type { SystemRole } from '@/types'

// Mirrors the admin app's system/usage.tsx exactly: same get_usage_stats()
// RPC, same four meters (Database Storage, File Storage, Receipt Emails,
// Auth Users), same super_admin gate and online-only rule. The admin app's
// System hub has one other entry (this Usage meter) and its Sync Status
// screen — the latter reports on the mobile app's local SQLite
// sync_queue/conflict_queue tables, which have no desktop equivalent since
// this app is not offline-first (CLAUDE.md §6, no local sync queue exists
// here) — that screen is out of scope, not ported, per CLAUDE_LOG.md.
interface UsageMeter {
  used_mb?: number
  limit_mb?: number
  percent: number
  label: string
}

interface EmailMeter {
  sent_this_month: number
  limit_monthly: number
  percent: number
  label: string
  note: string
}

interface AuthMeter {
  count: number
  limit: number
  percent: number
  label: string
}

interface UsageStats {
  measured_at: string
  database: UsageMeter
  storage: UsageMeter
  emails: EmailMeter
  auth_users: AuthMeter
}

function formatMb(mb: number | undefined): string {
  return mb !== undefined ? `${mb.toFixed(1)} MB` : '—'
}

interface MeterCardProps {
  label: string
  percent: number
  rawLabel: string
  note?: string
}

function MeterCard({ label, percent, rawLabel, note }: MeterCardProps): React.JSX.Element {
  const isCritical = percent >= 95
  const isWarning = percent >= 85
  const barColor = isWarning ? 'bg-red-500' : 'bg-green-500'

  return (
    <div className="rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
      <p className="mb-2 text-sm font-semibold text-jokenia-dark">{label}</p>
      <div className="h-2 overflow-hidden rounded-full bg-jokenia-cream2">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-jokenia-tan">{rawLabel}</span>
        <span
          className={`text-xs font-semibold ${isWarning ? 'text-red-600' : 'text-jokenia-dark2'}`}
        >
          {percent.toFixed(1)}%
        </span>
      </div>
      {isCritical ? (
        <p className="mt-1.5 text-[11px] font-medium text-red-600">
          Critical — upgrade immediately to prevent data loss
        </p>
      ) : isWarning ? (
        <p className="mt-1.5 text-[11px] font-medium text-red-600">
          Approaching limit — consider upgrading
        </p>
      ) : null}
      {note && <p className="mt-1 text-[10px] italic text-jokenia-tan">{note}</p>}
    </div>
  )
}

interface UsageSectionProps {
  role: SystemRole
}

function UsageSection({ role }: UsageSectionProps): React.JSX.Element {
  const isOnline = useAppStore((state) => state.isOnline)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isOnline || role !== 'super_admin') return
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase.rpc('get_usage_stats')
      if (error) throw error
      setStats(data as UsageStats)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load usage data.')
    } finally {
      setLoading(false)
    }
  }, [isOnline, role])

  useEffect(() => {
    void load()
  }, [load])

  if (role !== 'super_admin') {
    return (
      <p className="rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2.5 text-sm text-jokenia-tan">
        Usage monitoring is restricted to super administrators.
      </p>
    )
  }

  const lastChecked = stats?.measured_at
    ? new Date(stats.measured_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : null

  return (
    <div className="space-y-3">
      {!isOnline && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          Usage data requires an internet connection.
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-jokenia-tan">
          {lastChecked ? `Last checked: ${lastChecked}` : 'Not yet checked'}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={!isOnline || loading}
          className="text-xs font-medium text-jokenia-tan hover:text-jokenia-dark disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {stats && (
        <div className="space-y-2">
          <MeterCard
            label={stats.database.label}
            percent={stats.database.percent}
            rawLabel={`${formatMb(stats.database.used_mb)} / ${formatMb(stats.database.limit_mb)}`}
          />
          <MeterCard
            label={stats.storage.label}
            percent={stats.storage.percent}
            rawLabel={`${formatMb(stats.storage.used_mb)} / ${formatMb(stats.storage.limit_mb)}`}
          />
          <MeterCard
            label={stats.emails.label}
            percent={stats.emails.percent}
            rawLabel={`${stats.emails.sent_this_month.toLocaleString()} / ${stats.emails.limit_monthly.toLocaleString()} emails`}
            note={stats.emails.note}
          />
          <MeterCard
            label={stats.auth_users.label}
            percent={stats.auth_users.percent}
            rawLabel={`${stats.auth_users.count.toLocaleString()} / ${stats.auth_users.limit.toLocaleString()} users`}
          />
        </div>
      )}

      {!stats && !loading && !loadError && isOnline && (
        <p className="text-sm text-jokenia-tan">Tap Refresh to load usage stats.</p>
      )}
    </div>
  )
}

export default UsageSection
