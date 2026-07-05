import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'

function DiagnosticsSection(): React.JSX.Element {
  const [appVersion, setAppVersion] = useState('—')
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    window.electron.getVersion().then(setAppVersion)
  }, [])

  async function handleOpenLogs(): Promise<void> {
    setOpenError(null)
    const result = await window.electron.openLogsFolder()
    if (result) setOpenError(`Could not open logs folder: ${result}`)
  }

  const electronVersion = window.electron.process.versions.electron ?? '—'

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2.5 text-sm text-jokenia-dark">
        <p>
          App version: <span className="font-medium">{appVersion}</span>
        </p>
        <p>
          Electron version: <span className="font-medium">{electronVersion}</span>
        </p>
      </div>
      <Button variant="secondary" onClick={() => void handleOpenLogs()}>
        Open logs folder
      </Button>
      {openError && <p className="text-xs text-red-600">{openError}</p>}
    </div>
  )
}

export default DiagnosticsSection
