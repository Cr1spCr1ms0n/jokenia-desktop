import { useState } from 'react'
import PartnerList from '@/components/partners/PartnerList'
import PartnerDetail from '@/components/partners/PartnerDetail'
import RegisterPartnerForm from '@/components/partners/RegisterPartnerForm'

type View = { name: 'list' } | { name: 'detail'; partnerId: string } | { name: 'register' }

function PartnersPage(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'detail') {
    return <PartnerDetail partnerId={view.partnerId} onBack={() => setView({ name: 'list' })} />
  }

  if (view.name === 'register') {
    return (
      <RegisterPartnerForm
        onCreated={(partnerId) => setView({ name: 'detail', partnerId })}
        onCancel={() => setView({ name: 'list' })}
      />
    )
  }

  return (
    <PartnerList
      onSelect={(partnerId) => setView({ name: 'detail', partnerId })}
      onRegister={() => setView({ name: 'register' })}
    />
  )
}

export default PartnersPage
