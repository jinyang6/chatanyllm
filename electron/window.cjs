const path = require('path')
const os = require('os')

function isWindows11() {
  if (process.platform !== 'win32') return false
  const buildNumber = parseInt(os.release().split('.')[2] || '0')
  return buildNumber >= 22000
}

function getPlatformWindowConfig() {
  if (process.platform === 'win32') {
    console.log(`Window detected - using custom titlebar (${isWindows11() ? 'Windows 11' : 'Windows 10'})`)
    return {
      frame: false,
      titleBarStyle: 'hidden',
      transparent: false,
      hasShadow: true
    }
  }

  if (process.platform === 'darwin') {
    console.log('macOS detected - using native traffic lights')
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    }
  }

  console.log('Linux detected - using custom titlebar')
  return { frame: false }
}

function createWindow({ BrowserWindow, shell, ipcMain, isDev, showWindowTimeout, onWindowReady }) {
  const windowConfig = {
    width: 1200,
    height: 800,
    minWidth: 950,
    minHeight: 600,
    show: false,
    backgroundColor: '#F9F9F9',
    autoHideMenuBar: true,
    icon: path.join(__dirname, isDev ? '../public/icon.ico' : '../dist/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      enableBlinkFeatures: 'OverlayScrollbars',
      v8CacheOptions: isDev ? 'none' : 'bypassHeatCheck',
      spellcheck: false
    },
    ...getPlatformWindowConfig()
  }

  const mainWindow = new BrowserWindow(windowConfig)

  if (process.platform === 'win32') {
    try {
      mainWindow.setAutoHideMenuBar(true)
      mainWindow.setMenuBarVisibility(false)
    } catch (e) {
      console.warn('Could not hide menu bar:', e.message)
    }
  }

  const timeout = setTimeout(() => {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
      console.log('Window shown after timeout fallback')
    }
  }, 3000)

  if (isDev) {
    mainWindow.loadURL('http://localhost:3005')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost')) return
    if (!isDev && url.startsWith('file://')) return
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state-changed', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state-changed', false))

  ipcMain.handle('app:ready', () => {
    clearTimeout(timeout)
    if (!mainWindow.isVisible()) {
      mainWindow.show()
      console.log('Window shown after app:ready signal')
    }
  })

  onWindowReady(mainWindow)
  return mainWindow
}

module.exports = { createWindow }
