export type StaffStatus = 'pending' | 'approved' | 'rejected' | 'deactivated'

export interface StaffRow {
  id: string
  staff_code: string | null
  status: StaffStatus
  created_at: string
  full_name: string
  role: string
}
