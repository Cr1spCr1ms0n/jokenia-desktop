import { ElectronAPI } from '@electron-toolkit/preload'

interface JokeniaAPI {
  print: (htmlContent: string) => Promise<void>
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<void>
  getPreference: (key: string) => Promise<unknown>
  setPreference: (key: string, value: unknown) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI & JokeniaAPI
  }
}
