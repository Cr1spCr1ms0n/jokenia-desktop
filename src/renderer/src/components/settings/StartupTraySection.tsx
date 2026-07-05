import { useEffect, useState } from 'react'
import ToggleRow from './ToggleRow'

function StartupTraySection(): React.JSX.Element {
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [startMinimized, setStartMinimized] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [closeToTray, setCloseToTray] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      window.electron.getLoginAtStartup(),
      window.electron.getPreference('settings.startMinimized'),
      window.electron.getPreference('settings.minimizeToTray'),
      window.electron.getPreference('settings.closeToTray')
    ]).then(([login, minimized, minTray, closeTray]) => {
      setLaunchAtLogin(Boolean(login))
      setStartMinimized(Boolean(minimized))
      setMinimizeToTray(Boolean(minTray))
      setCloseToTray(Boolean(closeTray))
      setIsLoaded(true)
    })
  }, [])

  if (!isLoaded) {
    return <p className="text-sm text-jokenia-tan">Loading…</p>
  }

  return (
    <div className="space-y-2">
      <ToggleRow
        label="Launch at Windows login"
        description="Applies the next time Windows starts."
        checked={launchAtLogin}
        onChange={(value) => {
          setLaunchAtLogin(value)
          window.electron.setLoginAtStartup(value)
        }}
      />
      <ToggleRow
        label="Start minimized"
        description="Applies the next time the app starts."
        checked={startMinimized}
        onChange={(value) => {
          setStartMinimized(value)
          window.electron.setPreference('settings.startMinimized', value)
        }}
      />
      <ToggleRow
        label="Minimize to tray"
        description="Minimizing hides the window instead of showing it in the taskbar."
        checked={minimizeToTray}
        onChange={(value) => {
          setMinimizeToTray(value)
          window.electron.setPreference('settings.minimizeToTray', value)
        }}
      />
      <ToggleRow
        label="Close to tray"
        description="The window's close button hides the app. Quit fully from the tray icon's menu."
        checked={closeToTray}
        onChange={(value) => {
          setCloseToTray(value)
          window.electron.setPreference('settings.closeToTray', value)
        }}
      />
      <p className="pt-1 text-xs text-jokenia-tan">
        The tray icon menu always offers Open, Check for updates, and Quit.
      </p>
    </div>
  )
}

export default StartupTraySection
