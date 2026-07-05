import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import Store from 'electron-store'
import icon from '../../resources/icon.png?asset'
import { dialog } from 'electron' // Make sure dialog is imported at the top

const preferencesStore = new Store()

// Pushed to the renderer's Settings > Updates section so a manually-triggered
// check has visible state (checking/downloading %/downloaded/error) instead
// of only the silent background-check + native dialog this app already had.
interface UpdaterStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  percent?: number
  version?: string
  message?: string
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function broadcastUpdaterEvent(payload: UpdaterStatus): void {
  mainWindow?.webContents.send('updater-event', payload)
}

function createWindow(): void {
  const startMinimized = preferencesStore.get('settings.startMinimized', false) as boolean

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!startMinimized) {
      mainWindow?.show()
    }
  })

  // Settings > Startup & Tray: "minimize to tray". The 'minimize' event
  // isn't cancelable (no preventDefault, unlike 'close') — so instead of
  // stopping the minimize, this hides the window right after, which reads
  // the same to the operator (window gone from the taskbar, tray icon remains).
  mainWindow.on('minimize', () => {
    const minimizeToTray = preferencesStore.get('settings.minimizeToTray', false) as boolean
    if (minimizeToTray) {
      mainWindow?.hide()
    }
  })

  // Settings > Startup & Tray: "close to tray" — the window X hides the app;
  // only the tray menu's "Quit" (which sets isQuitting first) really exits.
  mainWindow.on('close', (event) => {
    const closeToTray = preferencesStore.get('settings.closeToTray', false) as boolean
    if (closeToTray && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  tray = new Tray(icon)
  tray.setToolTip('Jokenia Operations')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      { label: 'Check for updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// Creates a hidden window, loads the label HTML, prints it at the label's
// physical size (converted mm -> microns, the unit Chromium's print API
// expects), and tears the window down.
function printLabel(payload: { html: string; widthMm: number; heightMm: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const labelWindow = new BrowserWindow({ show: false })
    const silent = preferencesStore.get('settings.silentPrint', false) as boolean
    const deviceName = preferencesStore.get('settings.defaultLabelPrinter', '') as string

    labelWindow.webContents.once('did-finish-load', () => {
      labelWindow.webContents.print(
        {
          silent,
          printBackground: true,
          ...(deviceName ? { deviceName } : {}),
          pageSize: {
            width: payload.widthMm * 1000,
            height: payload.heightMm * 1000
          }
        },
        (success, errorType) => {
          labelWindow.destroy()
          if (success) {
            resolve()
          } else {
            reject(new Error(errorType))
          }
        }
      )
    })

    labelWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`)
  })
}

// Same hidden-window print pattern as printLabel, but with no custom
// pageSize — the operator picks their receipt printer and paper size in
// the print dialog, since (unlike labels) receipt printers aren't a fixed
// known size.
function printReceipt(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const receiptWindow = new BrowserWindow({ show: false })
    const silent = preferencesStore.get('settings.silentPrint', false) as boolean
    const deviceName = preferencesStore.get('settings.defaultReceiptPrinter', '') as string
    const copies = preferencesStore.get('settings.receiptCopyCount', 1) as number

    receiptWindow.webContents.once('did-finish-load', () => {
      receiptWindow.webContents.print(
        {
          silent,
          printBackground: true,
          copies,
          ...(deviceName ? { deviceName } : {})
        },
        (success, errorType) => {
          receiptWindow.destroy()
          if (success) {
            resolve()
          } else {
            reject(new Error(errorType))
          }
        }
      )
    })

    receiptWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.jokenia.operations-desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle(
    'print-label',
    (_event, payload: { html: string; widthMm: number; heightMm: number }) => printLabel(payload)
  )
  ipcMain.handle('print-receipt', (_event, html: string) => printReceipt(html))
  ipcMain.handle('app-get-version', () => app.getVersion())
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify())
  ipcMain.handle('preferences-get', (_event, key: string) => preferencesStore.get(key))
  ipcMain.handle('preferences-set', (_event, key: string, value: unknown) => {
    preferencesStore.set(key, value)
  })
  ipcMain.handle('get-printers', async () => {
    if (!mainWindow) return []
    const printers = await mainWindow.webContents.getPrintersAsync()
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName
    }))
  })
  ipcMain.handle('get-login-at-startup', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('set-login-at-startup', (_event, value: boolean) => {
    app.setLoginItemSettings({ openAtLogin: value })
  })
  ipcMain.handle('open-logs-folder', () => shell.openPath(app.getPath('logs')))

  // State-broadcasting listeners for the Settings > Updates panel. These are
  // additional listeners alongside the existing !is.dev dialog/error block
  // below (electron-updater/Node's EventEmitter support multiple listeners
  // per event) — added rather than folded into that block so the existing,
  // already-fixed OTA dialog logic (dispatch 4b904dfe) is reused untouched,
  // not duplicated.
  autoUpdater.on('checking-for-update', () => {
    preferencesStore.set('settings.lastUpdateCheckAt', new Date().toISOString())
    broadcastUpdaterEvent({ status: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    broadcastUpdaterEvent({ status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    broadcastUpdaterEvent({ status: 'not-available' })
  })
  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdaterEvent({ status: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', () => {
    broadcastUpdaterEvent({ status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    broadcastUpdaterEvent({ status: 'error', message: err.message })
  })

  if (!is.dev) {
    autoUpdater.on('update-available', () => {
      console.log('An update is available and downloading in the background...')
    })

    autoUpdater.on('update-downloaded', () => {
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready — Jokenia Operations',
          message: 'A new version has been downloaded.',
          detail:
            'Restart now to apply the update, or continue and it will be applied on next launch.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall(false, true)
          }
        })
    })

    autoUpdater.on('error', (err) => {
      console.error('AutoUpdater error:', err)
    })
  }

  createWindow()
  createTray()

  // Avoid blocking startup — check for updates a few seconds after boot.
  // Skipped in dev since there's no packaged app to update.
  if (!is.dev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 3000)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Distinguishes a real quit (tray "Quit", Cmd+Q, etc.) from the window's own
// close button, which close-to-tray intercepts in the 'close' handler above.
app.on('before-quit', () => {
  isQuitting = true
})
