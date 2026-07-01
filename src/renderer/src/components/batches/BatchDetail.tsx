import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import QueryState from '@/components/ui/QueryState'
import { BATCH_STATUS_LABELS, type BatchLineRow, type BatchRow } from './types'
import SuggestionResolutionModal from './SuggestionResolutionModal'

interface BatchDetailData {
  batch: BatchRow
  lines: BatchLineRow[]
}

// Same direct-table read pattern as the admin app's batch detail screen
// (BATCH_SELECT / BATCH_LINE_SELECT in cacheRefresh.ts) — approve_batch and
// reject_batch are the only batch-level RPCs; listing/detail is table reads.
async function fetchBatchDetail(batchId: string): Promise<BatchDetailData> {
  const [batchResult, linesResult] = await Promise.all([
    supabase
      .from('production_batches')
      .select('id, staff_id ( profiles!staff_id_fkey(full_name) ), production_date, status')
      .eq('id', batchId)
      .single(),
    supabase
      .from('batch_lines')
      .select(
        'id, batch_id, variation_id, suggestion_id, quantity, product_suggestions(variation_name), product_variations(name)'
      )
      .eq('batch_id', batchId)
  ])
  if (batchResult.error) throw batchResult.error
  if (linesResult.error) throw linesResult.error

  const b = batchResult.data as any
  const lineRows = (linesResult.data ?? []) as any[]

  return {
    batch: {
      id: b.id,
      status: b.status,
      production_date: b.production_date,
      staff_name: b.staff_id?.profiles?.full_name ?? 'Unknown',
      item_count: lineRows.length
    },
    lines: lineRows.map((l) => ({
      id: l.id,
      batch_id: l.batch_id,
      variation_id: l.variation_id,
      suggestion_id: l.suggestion_id,
      quantity: l.quantity ?? 1,
      resolved_name:
        l.suggestion_id != null
          ? (l.product_suggestions?.variation_name ?? 'Unresolved suggestion')
          : (l.product_variations?.name ?? 'Unknown product')
    }))
  }
}

interface BatchDetailProps {
  batchId: string
  onBack: () => void
}

function BatchDetail({ batchId, onBack }: BatchDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batch-detail', batchId],
    queryFn: () => fetchBatchDetail(batchId)
  })

  const [confirmApprove, setConfirmApprove] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resolvingSuggestionId, setResolvingSuggestionId] = useState<string | null>(null)

  function invalidateAndBack(): void {
    queryClient.invalidateQueries({ queryKey: ['batches'] })
    onBack()
  }

  async function handleApprove(): Promise<void> {
    setActionPending(true)
    setActionError(null)
    const { error: rpcError } = await supabase.rpc('approve_batch', { p_batch_id: batchId })
    setActionPending(false)
    if (rpcError) {
      setActionError(rpcError.message)
      return
    }
    setConfirmApprove(false)
    invalidateAndBack()
  }

  async function handleReject(): Promise<void> {
    if (!rejectReason.trim()) {
      setRejectError('Rejection reason is required.')
      return
    }
    setRejectError(null)
    setActionPending(true)
    setActionError(null)
    const { error: rpcError } = await supabase.rpc('reject_batch', {
      p_batch_id: batchId,
      p_reason: rejectReason.trim()
    })
    setActionPending(false)
    if (rpcError) {
      setActionError(rpcError.message)
      return
    }
    setShowRejectForm(false)
    invalidateAndBack()
  }

  function handleSuggestionResolved(): void {
    setResolvingSuggestionId(null)
    queryClient.invalidateQueries({ queryKey: ['batch-detail', batchId] })
    queryClient.invalidateQueries({ queryKey: ['batches'] })
  }

  function handleSuggestionRejected(): void {
    // reject_product_suggestion rejects the entire parent batch server-side.
    setResolvingSuggestionId(null)
    invalidateAndBack()
  }

  const allResolved = data ? data.lines.every((line) => line.suggestion_id == null) : false
  const canApprove = data?.batch.status === 'pending_verification' && allResolved
  const canReject = data ? data.batch.status !== 'approved' && data.batch.status !== 'rejected' : false

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to batches
      </button>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={!data}
        emptyText="Batch not found."
        onRetry={refetch}
      >
        {data && (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4 rounded-md border border-jokenia-tan/20 bg-white/60 p-4">
              <p className="font-mono text-xs text-jokenia-tan">Batch {batchId.slice(0, 8)}</p>
              <p className="font-heading text-lg font-semibold text-jokenia-dark">{data.batch.staff_name}</p>
              <p className="text-xs text-jokenia-tan">
                {BATCH_STATUS_LABELS[data.batch.status] ?? data.batch.status} · Production{' '}
                {new Date(data.batch.production_date).toLocaleDateString('en-KE')}
              </p>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-jokenia-dark2">
              {data.lines.length} line{data.lines.length !== 1 ? 's' : ''}
            </p>

            <div className="mb-4 space-y-2">
              {data.lines.map((line, index) => {
                const tappable = line.suggestion_id != null
                return (
                  <div
                    key={line.id}
                    onClick={
                      tappable
                        ? () => {
                            if (line.suggestion_id) setResolvingSuggestionId(line.suggestion_id)
                          }
                        : undefined
                    }
                    className={`flex items-center justify-between rounded-md border border-jokenia-tan/20 bg-white/60 p-3 ${
                      tappable ? 'cursor-pointer hover:bg-white' : ''
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                        Line {index + 1}
                      </p>
                      <p className="text-sm font-medium text-jokenia-dark">{line.resolved_name}</p>
                      <p className="text-xs text-jokenia-dark2">Qty: {line.quantity}</p>
                    </div>
                    {tappable && (
                      <span className="rounded-full bg-jokenia-gold px-2 py-0.5 text-[10px] font-semibold text-jokenia-dark">
                        Unresolved suggestion
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {!allResolved && (
              <div className="mb-4 rounded-md border border-jokenia-gold/40 bg-jokenia-gold/10 p-3">
                <p className="text-xs text-jokenia-dark2">
                  Resolve all product suggestions before approving. Click a suggestion line to resolve it.
                </p>
              </div>
            )}

            {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

            {showRejectForm ? (
              <div className="rounded-md border border-red-300 bg-white/60 p-4">
                <p className="font-heading text-sm font-semibold text-jokenia-dark">Reject Batch</p>
                <p className="mb-2 text-xs text-jokenia-tan">A reason is mandatory and will be recorded.</p>
                {rejectError && <p className="mb-2 text-xs text-red-600">{rejectError}</p>}
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="State the reason for rejection…"
                  rows={3}
                  className="mb-3 w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowRejectForm(false)
                      setRejectReason('')
                      setRejectError(null)
                    }}
                    disabled={actionPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleReject} disabled={actionPending}>
                    {actionPending ? 'Saving…' : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {canApprove && (
                  <Button onClick={() => setConfirmApprove(true)} disabled={actionPending}>
                    Approve Batch
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="secondary"
                    onClick={() => setShowRejectForm(true)}
                    disabled={actionPending}
                  >
                    Reject Batch
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </QueryState>

      <Modal title="Approve Batch" isOpen={confirmApprove} onClose={() => setConfirmApprove(false)}>
        <p className="mb-4 text-sm text-jokenia-dark2">
          Approve this batch and generate serialized items?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setConfirmApprove(false)} disabled={actionPending}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={actionPending}>
            {actionPending ? 'Approving…' : 'Approve'}
          </Button>
        </div>
      </Modal>

      {resolvingSuggestionId && (
        <SuggestionResolutionModal
          suggestionId={resolvingSuggestionId}
          onClose={() => setResolvingSuggestionId(null)}
          onResolved={handleSuggestionResolved}
          onRejected={handleSuggestionRejected}
        />
      )}
    </div>
  )
}

export default BatchDetail
