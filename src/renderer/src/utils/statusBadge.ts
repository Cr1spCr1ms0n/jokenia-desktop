const REJECTED_OVERDUE = ['rejected', 'inactive', 'overdue', 'damaged', 'failed']
const APPROVED_CLOSED = ['approved', 'closed', 'settled']
const IN_PROGRESS = ['in_progress', 'pending_product_approval', 'ready', 'awaiting_dispatch']
const PENDING_ACTIVE = ['pending', 'pending_verification', 'active', 'intake']

export function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase()
  if (REJECTED_OVERDUE.includes(normalized)) return 'bg-red-500 text-white'
  if (APPROVED_CLOSED.includes(normalized)) return 'bg-green-600 text-white'
  if (IN_PROGRESS.includes(normalized)) return 'bg-jokenia-tan text-white'
  if (PENDING_ACTIVE.includes(normalized)) return 'bg-jokenia-gold text-jokenia-dark'
  return 'bg-jokenia-tan text-white'
}
