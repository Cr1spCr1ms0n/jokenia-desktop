import { useState } from 'react'
import MarketList from '@/components/markets/MarketList'
import MarketDetail from '@/components/markets/MarketDetail'
import NewMarketEventForm from '@/components/markets/NewMarketEventForm'

type View = { name: 'list' } | { name: 'detail'; eventId: string } | { name: 'new' }

function MarketsPage(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'detail') {
    return <MarketDetail eventId={view.eventId} onBack={() => setView({ name: 'list' })} />
  }

  if (view.name === 'new') {
    return (
      <NewMarketEventForm
        onCreated={(eventId) => setView({ name: 'detail', eventId })}
        onCancel={() => setView({ name: 'list' })}
      />
    )
  }

  return (
    <MarketList
      onSelect={(eventId) => setView({ name: 'detail', eventId })}
      onCreate={() => setView({ name: 'new' })}
    />
  )
}

export default MarketsPage
