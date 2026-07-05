import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { StaffRow, StaffStatus } from './types'

interface StaffJoinRow {
  id: string
  staff_code: string | null
  status: StaffStatus
  created_at: string
  profiles: { full_name: string; role: string } | null
}

async function fetchStaffMember(staffId: string): Promise<StaffRow> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, staff_code, status, created_at, profiles!staff_id_fkey(full_name, role)')
    .eq('id', staffId)
    .single()
  if (error) throw error
  const row = data as unknown as StaffJoinRow
  return {
    id: row.id,
    staff_code: row.staff_code,
    status: row.status,
    created_at: row.created_at,
    full_name: row.profiles?.full_name ?? 'Unknown',
    role: row.profiles?.role ?? 'staff'
  }
}

function statusBadgeClasses(status: StaffStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-500 text-white'
    case 'approved':
      return 'bg-green-600 text-white'
    case 'rejected':
      return 'bg-red-500 text-white'
    case 'deactivated':
      return 'bg-jokenia-tan text-white'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

interface StaffDetailProps {
  staffId: string
  onBack: () => void
}

function StaffDetail({ staffId, onBack }: StaffDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const isOnline = useAppStore((state) => state.isOnline)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [reason, setReason] = useState('')

  const memberQuery = useQuery({
    queryKey: ['staff-member', staffId],
    queryFn: () => fetchStaffMember(staffId)
  })

  function invalidateAll(): void {
    queryClient.invalidateQueries({ queryKey: ['staff-member', staffId] })
    queryClient.invalidateQueries({ queryKey: ['staff'] })
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('approve_staff', { p_staff_id: staffId })
      if (error) throw error
    },
    onSuccess: invalidateAll
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reject_staff', {
        p_staff_id: staffId,
        p_reason: reason.trim()
      })
      if (error) throw error
    },
    onSuccess: () => {
      setRejectOpen(false)
      setReason('')
      invalidateAll()
    }
  })

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('deactivate_staff', {
        p_staff_id: staffId,
        p_reason: reason.trim()
      })
      if (error) throw error
    },
    onSuccess: () => {
      setDeactivateOpen(false)
      setReason('')
      invalidateAll()
    }
  })

  const member = memberQuery.data
  const anyMutating =
    approveMutation.isPending || rejectMutation.isPending || deactivateMutation.isPending

  function closeReject(): void {
    if (rejectMutation.isPending) return
    setRejectOpen(false)
    setReason('')
  }

  function closeDeactivate(): void {
    if (deactivateMutation.isPending) return
    setDeactivateOpen(false)
    setReason('')
  }

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to staff
      </button>

      <QueryState
        isLoading={memberQuery.isLoading}
        error={memberQuery.error as Error | null}
        isEmpty={!member}
        emptyText="Staff member not found."
        onRetry={memberQuery.refetch}
      >
        {member && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-jokenia-dark">
                  {member.full_name}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(member.status)}`}
                >
                  {member.status}
                </span>
              </div>
              <p className="font-mono text-xs text-jokenia-tan">
                {member.staff_code ?? 'Not yet assigned'}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs text-jokenia-dark2">
                <p>Role: {member.role}</p>
                <p>Registered: {formatDate(member.created_at)}</p>
              </div>
            </div>

            {!isOnline && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                Offline — staff actions require an internet connection.
              </p>
            )}

            {(approveMutation.error || rejectMutation.error || deactivateMutation.error) && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {
                  (
                    (approveMutation.error ??
                      rejectMutation.error ??
                      deactivateMutation.error) as Error
                  ).message
                }
              </p>
            )}

            {member.status === 'pending' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={!isOnline || anyMutating}
                >
                  {approveMutation.isPending ? 'Approving…' : 'Approve'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setRejectOpen(true)}
                  disabled={!isOnline || anyMutating}
                  className="!bg-red-600 !text-white hover:!brightness-110"
                >
                  Reject…
                </Button>
              </div>
            )}

            {member.status === 'approved' && (
              <Button
                onClick={() => setDeactivateOpen(true)}
                disabled={!isOnline || anyMutating}
                className="w-full !bg-red-600 !text-white hover:!brightness-110"
              >
                Deactivate…
              </Button>
            )}

            {(member.status === 'rejected' || member.status === 'deactivated') && (
              <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                {member.status === 'rejected'
                  ? 'This staff member has been rejected.'
                  : 'This staff member is deactivated and cannot log in.'}
              </p>
            )}
          </div>
        )}
      </QueryState>

      <Modal title="Reject staff" isOpen={rejectOpen} onClose={closeReject}>
        <div className="space-y-2">
          <p className="text-xs text-jokenia-tan">
            A reason is mandatory and will be recorded in the audit log.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="State the reason for rejection…"
            disabled={rejectMutation.isPending}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={closeReject}
              disabled={rejectMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !reason.trim()}
              className="flex-1 !bg-red-600 !text-white hover:!brightness-110"
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal title="Deactivate staff" isOpen={deactivateOpen} onClose={closeDeactivate}>
        <div className="space-y-2">
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            This will immediately prevent {member?.full_name ?? 'this staff member'} from logging
            in. A reason is mandatory and will be recorded in the audit log.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="State the reason for deactivation…"
            disabled={deactivateMutation.isPending}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={closeDeactivate}
              disabled={deactivateMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending || !reason.trim()}
              className="flex-1 !bg-red-600 !text-white hover:!brightness-110"
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Confirm Deactivation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default StaffDetail
