import type { MarketEvent } from '@/types'

export type { MarketEvent }

export interface MarketEventDetail {
  event: Omit<MarketEvent, 'sale_count' | 'total_revenue'>
  summary: { sale_count: number; total_revenue: number; avg_sale_value: number }
  sales: Array<{
    id: string
    sale_type: string
    net_amount: number
    online_platform: string | null
    created_at: string
  }>
}

export interface NewMarketEventInput {
  name: string
  series_name: string
  location: string
  start_date: string
  end_date: string
  notes: string
}
