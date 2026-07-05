import { ElectronAPI } from '@electron-toolkit/preload'

interface UpdaterStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  percent?: number
  version?: string
  message?: string
}

interface JokeniaAPI {
  print: (payload: { html: string; widthMm: number; heightMm: number }) => Promise<void>
  printReceipt: (html: string) => Promise<void>
  exportPdf: (payload: {
    html: string
    defaultFileName: string
  }) => Promise<{ canceled: boolean; filePath?: string }>
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<void>
  getPreference: (key: string) => Promise<unknown>
  setPreference: (key: string, value: unknown) => Promise<void>
  getPrinters: () => Promise<Array<{ name: string; displayName: string }>>
  getLoginAtStartup: () => Promise<boolean>
  setLoginAtStartup: (value: boolean) => Promise<void>
  openLogsFolder: () => Promise<string>
  onUpdaterEvent: (callback: (status: UpdaterStatus) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI & JokeniaAPI
  }
}
