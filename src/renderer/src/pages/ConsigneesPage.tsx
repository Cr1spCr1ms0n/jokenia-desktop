import { useState } from 'react'
import ConsigneeList from '@/components/consignees/ConsigneeList'
import ConsigneeDetail from '@/components/consignees/ConsigneeDetail'
import RegisterConsigneeForm from '@/components/consignees/RegisterConsigneeForm'
import CareRegister from '@/components/consignees/CareRegister'

type View =
  | { name: 'list' }
  | { name: 'detail'; clientId: string }
  | { name: 'register' }
  | { name: 'care-register' }

function ConsigneesPage(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'detail') {
    return <ConsigneeDetail clientId={view.clientId} onBack={() => setView({ name: 'list' })} />
  }

  if (view.name === 'register') {
    return (
      <RegisterConsigneeForm
        onCreated={(clientId) => setView({ name: 'detail', clientId })}
        onCancel={() => setView({ name: 'list' })}
      />
    )
  }

  if (view.name === 'care-register') {
    return <CareRegister onBack={() => setView({ name: 'list' })} />
  }

  return (
    <ConsigneeList
      onSelect={(clientId) => setView({ name: 'detail', clientId })}
      onRegister={() => setView({ name: 'register' })}
      onViewCareRegister={() => setView({ name: 'care-register' })}
    />
  )
}

export default ConsigneesPage
