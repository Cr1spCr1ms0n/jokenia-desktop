import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import TicketList from '@/components/services/TicketList'
import TicketDetail from '@/components/services/TicketDetail'
import NewTicketForm from '@/components/services/NewTicketForm'

function ServicesPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)

  if (selectedTicketId) {
    return <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
  }

  return (
    <>
      <TicketList onSelect={setSelectedTicketId} onNewTicket={() => setShowNewTicketForm(true)} />
      {showNewTicketForm && (
        <NewTicketForm
          onClose={() => setShowNewTicketForm(false)}
          onCreated={(result) => {
            setShowNewTicketForm(false)
            queryClient.invalidateQueries({ queryKey: ['service-tickets'] })
            setSelectedTicketId(result.ticket_id)
          }}
        />
      )}
    </>
  )
}

export default ServicesPage
