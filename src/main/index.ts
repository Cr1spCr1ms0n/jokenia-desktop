import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import Store from 'electron-store'
import icon from '../../resources/icon.png?asset'

const preferencesStore = new Store()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

// Creates a hidden window, loads the label HTML, prints it, and tears the
// window down. Label content rendering (barcode, serial, SKU, size, price)
// is scaffolded here only — the full label renderer lands in a later session.
function printLabel(htmlContent: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const labelWindow = new BrowserWindow({ show: false })

    labelWindow.webContents.once('did-finish-load', () => {
      labelWindow.webContents.print({ silent: false }, (success, errorType) => {
        labelWindow.destroy()
        if (success) {
          resolve()
        } else {
          reject(new Error(errorType))
        }
      })
    })

    labelWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
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

  ipcMain.handle('print-label', (_event, htmlContent: string) => printLabel(htmlContent))
  ipcMain.handle('app-get-version', () => app.getVersion())
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify())
  ipcMain.handle('preferences-get', (_event, key: string) => preferencesStore.get(key))
  ipcMain.handle('preferences-set', (_event, key: string, value: unknown) => {
    preferencesStore.set(key, value)
  })

  createWindow()

  // Avoid blocking startup — check for updates a few seconds after boot.
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 3000)

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
