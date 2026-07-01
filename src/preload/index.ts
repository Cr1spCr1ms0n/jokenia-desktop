import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer — merged onto window.electron alongside the
// @electron-toolkit utilities (ipcRenderer, process, webFrame).
const api = {
  print: (htmlContent: string): Promise<void> => ipcRenderer.invoke('print-label', htmlContent),
  getVersion: (): Promise<string> => ipcRenderer.invoke('app-get-version'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),
  getPreference: (key: string): Promise<unknown> => ipcRenderer.invoke('preferences-get', key),
  setPreference: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('preferences-set', key, value)
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
