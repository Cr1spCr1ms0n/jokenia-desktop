import { useState } from 'react'
import BatchList from '@/components/batches/BatchList'
import BatchDetail from '@/components/batches/BatchDetail'

function BatchesPage(): React.JSX.Element {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)

  if (selectedBatchId) {
    return <BatchDetail batchId={selectedBatchId} onBack={() => setSelectedBatchId(null)} />
  }

  return <BatchList onSelect={setSelectedBatchId} />
}

export default BatchesPage
