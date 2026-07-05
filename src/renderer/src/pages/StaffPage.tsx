import { useState } from 'react'
import StaffList from '@/components/staff/StaffList'
import StaffDetail from '@/components/staff/StaffDetail'

type View = { name: 'list' } | { name: 'detail'; staffId: string }

function StaffPage(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'detail') {
    return <StaffDetail staffId={view.staffId} onBack={() => setView({ name: 'list' })} />
  }

  return <StaffList onSelect={(staffId) => setView({ name: 'detail', staffId })} />
}

export default StaffPage
