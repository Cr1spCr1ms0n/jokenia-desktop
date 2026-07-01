export type ServiceTicketStatus = 'intake' | 'in_progress' | 'ready' | 'awaiting_dispatch' | 'closed'
export type ServiceType = 'fix' | 'adjustment'
export type DispatchMethod = 'pickup' | 'delivery'

export const STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  intake: 'Intake',
  in_progress: 'In Progress',
  ready: 'Ready',
  awaiting_dispatch: 'Awaiting Dispatch',
  closed: 'Closed'
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  fix: 'Fix',
  adjustment: 'Adjustment'
}

export interface ServiceClient {
  id: string
  name: string
  phone: string
  email: string | null
}

export interface ServiceTicketSummary {
  id: string
  ticket_number: string
  service_type: ServiceType
  item_description: string
  status: ServiceTicketStatus
  quoted_fee: number
  final_fee: number | null
  dispatch_method: DispatchMethod | null
  created_at: string
  closed_at: string | null
  days_open: number
  client: ServiceClient
  assigned_to_name: string | null
}

export interface ServiceTicketLog {
  id: string
  note: string
  status_at: ServiceTicketStatus
  created_at: string
  created_by_name: string | null
}

export interface ServiceTicketDetail extends ServiceTicketSummary {
  logs: ServiceTicketLog[]
}

export interface OpenServiceTicketPayload {
  p_client_name: string
  p_client_phone: string
  p_service_type: ServiceType
  p_item_description: string
  p_client_email?: string
  p_quoted_fee?: number
  p_opening_note?: string
}

export interface OpenServiceTicketResult {
  success: boolean
  ticket_id: string
  ticket_number: string
  client_id: string
}

export function formatFee(fee: number | null): string {
  if (fee == null) return '—'
  return fee === 0 ? 'KES 0 (No charge)' : `KES ${fee.toLocaleString('en-KE')}`
}

export function formatDaysOpen(ticket: ServiceTicketSummary): string {
  const label = ticket.days_open === 1 ? '1 day' : `${ticket.days_open} days`
  return ticket.status === 'closed' ? `Closed after ${label}` : `${label} open`
}
