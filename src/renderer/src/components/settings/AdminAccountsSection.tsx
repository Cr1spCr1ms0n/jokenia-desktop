import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { statusBadgeClass } from '@/utils/statusBadge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import CreateAdminModal from '@/components/settings/CreateAdminModal'

interface AdminAccount {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'super_admin'
  deactivated_at: string | null
  created_at: string
}

async function fetchAdminAccounts(): Promise<AdminAccount[]> {
  const { data, error } = await supabase.rpc('get_admin_accounts')
  if (error) throw error
  return (data ?? []) as AdminAccount[]
}

interface DeactivateModalProps {
  account: AdminAccount
  onClose: () => void
  onDone: () => void
}

function DeactivateModal({ account, onClose, onDone }: DeactivateModalProps): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    if (!reason.trim()) return
    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('deactivate_admin_account', {
      p_user_id: account.id,
      p_reason: reason.trim()
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onDone()
  }

  return (
    <Modal title={`Deactivate ${account.full_name}`} isOpen onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-jokenia-tan">
          This immediately revokes {account.full_name}&apos;s access to the app. It can be reversed later via
          Reactivate.
        </p>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan">
            Reason *
          </label>
          <textarea
            className="w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this account being deactivated?"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!reason.trim() || submitting}>
            {submitting ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface ReactivateModalProps {
  account: AdminAccount
  onClose: () => void
  onDone: () => void
}

function ReactivateModal({ account, onClose, onDone }: ReactivateModalProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('reactivate_admin_account', {
      p_user_id: account.id
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onDone()
  }

  return (
    <Modal title={`Reactivate ${account.full_name}`} isOpen onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-jokenia-dark">
          Restore {account.full_name}&apos;s access to the admin app?
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? 'Reactivating…' : 'Reactivate'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AdminAccountsSection(): React.JSX.Element {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: fetchAdminAccounts
  })

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminAccount | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<AdminAccount | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function refresh(): void {
    queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
  }

  function flashSuccess(message: string): void {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage((current) => (current === message ? null : current)), 3000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-jokenia-tan">
          {data ? `${data.length} admin account${data.length === 1 ? '' : 's'}` : ''}
        </p>
        <Button onClick={() => setShowCreateModal(true)}>+ New Admin</Button>
      </div>

      {successMessage && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">{successMessage}</p>
      )}

      {isLoading && <p className="text-sm text-jokenia-tan">Loading…</p>}

      {error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-red-600">{(error as Error).message}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((account) => (
                <tr key={account.id} className="border-t border-jokenia-tan/10 align-top">
                  <td className="px-3 py-2">
                    <p className="text-jokenia-dark">{account.full_name}</p>
                    <p className="text-xs text-jokenia-tan">{account.email}</p>
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {account.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                        account.deactivated_at ? 'inactive' : 'active'
                      )}`}
                    >
                      {account.deactivated_at ? 'Deactivated' : 'Active'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {account.role === 'admin' &&
                      (account.deactivated_at ? (
                        <Button variant="secondary" onClick={() => setReactivateTarget(account)}>
                          Reactivate
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => setDeactivateTarget(account)}>
                          Deactivate
                        </Button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            refresh()
            flashSuccess('Admin account created.')
          }}
        />
      )}

      {deactivateTarget && (
        <DeactivateModal
          account={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={() => {
            setDeactivateTarget(null)
            refresh()
          }}
        />
      )}

      {reactivateTarget && (
        <ReactivateModal
          account={reactivateTarget}
          onClose={() => setReactivateTarget(null)}
          onDone={() => {
            setReactivateTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default AdminAccountsSection
