import { useEffect, useState } from 'react'

const MIN_ZOOM = 0.8
const MAX_ZOOM = 1.5
const STEP = 0.1

function DisplaySection(): React.JSX.Element {
  const [zoom, setZoom] = useState(1)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    window.electron.getPreference('settings.zoomLevel').then((value) => {
      setZoom(typeof value === 'number' ? value : 1)
      setIsLoaded(true)
    })
  }, [])

  function applyZoom(factor: number): void {
    setZoom(factor)
    window.electron.webFrame.setZoomFactor(factor)
    window.electron.setPreference('settings.zoomLevel', factor)
  }

  if (!isLoaded) {
    return <p className="text-sm text-jokenia-tan">Loading…</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-jokenia-tan">
          UI zoom
        </label>
        <span className="text-sm font-medium text-jokenia-dark">{Math.round(zoom * 100)}%</span>
      </div>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={STEP}
        value={zoom}
        onChange={(event) => applyZoom(parseFloat(event.target.value))}
        className="w-full accent-jokenia-gold"
      />
      <button
        type="button"
        onClick={() => applyZoom(1)}
        className="text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        Reset to 100%
      </button>
    </div>
  )
}

export default DisplaySection
