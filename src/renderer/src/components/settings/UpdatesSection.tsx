import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import type { UpdaterStatus } from '@/types'

const STATUS_COPY: Record<UpdaterStatus['status'], string> = {
  checking: 'Checking for updates…',
  available: 'Update found — downloading…',
  'not-available': 'You are on the latest version.',
  downloading: 'Downloading update…',
  downloaded: 'Update downloaded — restart to apply.',
  error: 'Update check failed.'
}

function formatLastChecked(value: unknown): string {
  if (typeof value !== 'string') return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}

function UpdatesSection(): React.JSX.Element {
  const [version, setVersion] = useState('—')
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null)
  const [lastChecked, setLastChecked] = useState('Never')
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    window.electron.getVersion().then(setVersion)
    window.electron.getPreference('settings.lastUpdateCheckAt').then((value) => {
      setLastChecked(formatLastChecked(value))
    })

    const unsubscribe = window.electron.onUpdaterEvent((status) => {
      setUpdater(status)
      if (status.status === 'checking') {
        setIsChecking(true)
        window.electron.getPreference('settings.lastUpdateCheckAt').then((value) => {
          setLastChecked(formatLastChecked(value))
        })
      }
      if (
        status.status === 'not-available' ||
        status.status === 'downloaded' ||
        status.status === 'error'
      ) {
        setIsChecking(false)
      }
    })

    return unsubscribe
  }, [])

  async function handleCheck(): Promise<void> {
    setIsChecking(true)
    await window.electron.checkForUpdates()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-jokenia-tan/20 bg-white/60 px-3 py-2.5">
        <p className="text-sm text-jokenia-dark">
          Current version: <span className="font-semibold">{version}</span>
        </p>
        <p className="text-xs text-jokenia-tan">Last checked: {lastChecked}</p>
      </div>

      <Button variant="primary" onClick={() => void handleCheck()} disabled={isChecking}>
        {isChecking ? 'Checking…' : 'Check for updates'}
      </Button>

      {updater && (
        <div
          className={`rounded-md px-3 py-2.5 text-sm ${
            updater.status === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-jokenia-cream2 text-jokenia-dark'
          }`}
        >
          <p>{STATUS_COPY[updater.status]}</p>
          {updater.status === 'downloading' && typeof updater.percent === 'number' && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-jokenia-tan/20">
              <div
                className="h-full rounded-full bg-jokenia-gold transition-all"
                style={{ width: `${updater.percent}%` }}
              />
            </div>
          )}
          {updater.status === 'available' && updater.version && (
            <p className="text-xs text-jokenia-tan">Version {updater.version}</p>
          )}
          {updater.status === 'error' && updater.message && (
            <p className="text-xs">{updater.message}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default UpdatesSection
