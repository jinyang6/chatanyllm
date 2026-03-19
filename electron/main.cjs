// Electron main process
// Note: This file uses CommonJS (.cjs) to ensure compatibility with Electron's module system

let app, BrowserWindow, ipcMain, dialog, shell, safeStorage

try {
  const electron = require('electron')

  if (typeof electron === 'string') {
    console.error('ERROR: Electron API not available - try: npx electron . or npm run app')
    process.exit(1)
  }

  ;({ app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = electron)

  if (!app || !BrowserWindow) {
    console.error('ERROR: Electron modules not properly loaded')
    process.exit(1)
  }

  console.log('Electron main process initialized')
} catch (error) {
  console.error('ERROR: Failed to load Electron:', error.message)
  process.exit(1)
}

const { createWindow } = require('./window.cjs')
const { registerFsHandlers } = require('./ipc/fs.cjs')
const { registerStoreHandlers } = require('./ipc/store.cjs')
const { registerShellHandlers } = require('./ipc/shell.cjs')
const { registerUpdaterHandlers } = require('./ipc/updater.cjs')
const { initAutoUpdater, setMainWindow } = require('./updater.cjs')

const isDev = !app.isPackaged

let mainWindow = null
const getMainWindow = () => mainWindow

// VS Code-inspired performance flags
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
  app.commandLine.appendSwitch('enable-gpu-rasterization')
  app.commandLine.appendSwitch('enable-zero-copy')
}

// Register all IPC handlers
registerFsHandlers(ipcMain)
registerStoreHandlers(ipcMain, app, safeStorage)
registerShellHandlers(ipcMain, getMainWindow, shell, dialog)
registerUpdaterHandlers(ipcMain)

ipcMain.handle('get-app-data-path', () => app.getPath('userData'))

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.chatanyllm.app')
  }

  mainWindow = createWindow({
    BrowserWindow,
    shell,
    ipcMain,
    isDev,
    onWindowReady: (win) => { mainWindow = win; setMainWindow(win) }
  })

  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow({
        BrowserWindow,
        shell,
        ipcMain,
        isDev,
        onWindowReady: (win) => { mainWindow = win }
      })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

console.log('App data path:', app.getPath('userData'))
console.log('Dev mode:', isDev)
