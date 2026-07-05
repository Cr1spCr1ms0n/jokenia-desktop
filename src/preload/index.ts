import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface UpdaterStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  percent?: number
  version?: string
  message?: string
}

// Custom APIs for renderer — merged onto window.electron alongside the
// @electron-toolkit utilities (ipcRenderer, process, webFrame).
const api = {
  print: (payload: { html: string; widthMm: number; heightMm: number }): Promise<void> =>
    ipcRenderer.invoke('print-label', payload),
  printReceipt: (html: string): Promise<void> => ipcRenderer.invoke('print-receipt', html),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app-get-version'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),
  getPreference: (key: string): Promise<unknown> => ipcRenderer.invoke('preferences-get', key),
  setPreference: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('preferences-set', key, value),
  getPrinters: (): Promise<Array<{ name: string; displayName: string }>> =>
    ipcRenderer.invoke('get-printers'),
  getLoginAtStartup: (): Promise<boolean> => ipcRenderer.invoke('get-login-at-startup'),
  setLoginAtStartup: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('set-login-at-startup', value),
  openLogsFolder: (): Promise<string> => ipcRenderer.invoke('open-logs-folder'),
  onUpdaterEvent: (callback: (status: UpdaterStatus) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: UpdaterStatus): void => callback(status)
    ipcRenderer.on('updater-event', listener)
    return () => ipcRenderer.removeListener('updater-event', listener)
  }
}

const electronBridge = { ...electronAPI, ...api }

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronBridge)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronBridge
}
