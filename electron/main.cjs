// Electron main process
// Note: This file uses CommonJS (.cjs) to ensure compatibility with Electron's module system

const path = require('path')
const fs = require('fs/promises')

// Import Electron modules
// When running in Electron context, these should be available
let app, BrowserWindow, ipcMain, dialog, shell, safeStorage

try {
  const electron = require('electron')

  // Check if we got the actual Electron API or just a path string
  if (typeof electron === 'string') {
    console.error('ERROR: Electron API not available in current context')
    console.error('This usually means Electron is not running correctly')
    console.error('Try: npx electron . or npm run app')
    process.exit(1)
  }

  ({ app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = electron)

  if (!app || !BrowserWindow) {
    console.error('ERROR: Electron modules not properly loaded')
    process.exit(1)
  }

  console.log('✓ Electron main process initialized successfully')
} catch (error) {
  console.error('ERROR: Failed to load Electron:', error.message)
  process.exit(1)
}

// More reliable dev detection - check if running from source or packaged
const isDev = !app.isPackaged

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,  // Remove default title bar
    titleBarStyle: 'hidden',  // Hide title bar on macOS
    backgroundColor: '#F9F9F9',  // Match app background
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false  // Disable CORS for custom API providers
    },
    autoHideMenuBar: true,
    icon: isDev
      ? path.join(__dirname, '../public/icon.ico')
      : path.join(__dirname, '../dist/icon.ico')
  })

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3005')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' } // Prevent opening in Electron
  })

  // Handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentURL = mainWindow.webContents.getURL()
    // Allow navigation within the app (localhost in dev, file:// in prod)
    if (isDev && url.startsWith('http://localhost')) {
      return // Allow internal navigation
    }
    if (!isDev && url.startsWith('file://')) {
      return // Allow internal navigation
    }
    // External URL - open in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ===== IPC Handlers for File System Operations =====

// Get app data path for storing conversations
ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData')
})

// Read file
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Write file with atomic operation (temp file + rename)
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Use temp file + rename for atomic writes
    // This prevents partial writes from corrupting files
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
    await fs.writeFile(tempPath, content, 'utf-8')

    // Rename is atomic on most filesystems
    await fs.rename(tempPath, filePath)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Delete file
ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  console.log('IPC fs:deleteFile called with path:', filePath)
  try {
    await fs.unlink(filePath)
    console.log('File deleted successfully:', filePath)
    return { success: true }
  } catch (error) {
    console.error('File deletion error:', error.message)
    return { success: false, error: error.message }
  }
})

// List files in directory
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath)
    return { success: true, files }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Check if file exists
ipcMain.handle('fs:exists', async (event, filePath) => {
  try {
    await fs.access(filePath)
    return { success: true, exists: true }
  } catch (error) {
    return { success: true, exists: false }
  }
})

// Create directory
ipcMain.handle('fs:mkdir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Write binary file (for images, etc.)
ipcMain.handle('fs:writeBinaryFile', async (event, filePath, base64Data) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Remove data URL prefix if present (data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

    // Convert base64 to buffer
    const buffer = Buffer.from(cleanBase64, 'base64')

    // Use temp file + rename for atomic writes
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
    await fs.writeFile(tempPath, buffer)

    // Rename is atomic on most filesystems
    await fs.rename(tempPath, filePath)

    return { success: true, path: filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Show open dialog
ipcMain.handle('dialog:openFile', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options)
    return { success: true, ...result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Show save dialog
ipcMain.handle('dialog:saveFile', async (event, options) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, options)
    return { success: true, ...result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ===== Secure Storage for API Keys =====
// Using Electron's safeStorage API with Windows DPAPI encryption
// API keys are encrypted before being written to disk

// Write queue to prevent race conditions when multiple store operations happen simultaneously
let storeWriteQueue = Promise.resolve()

// Encryption helper functions
function encryptData(plainText) {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('DPAPI encryption not available on Windows')
    return null
  }
  try {
    const buffer = safeStorage.encryptString(plainText)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Encryption failed:', error)
    return null
  }
}

function decryptData(encryptedBase64) {
  if (!safeStorage.isEncryptionAvailable()) {
    return null
  }
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}

// Check if data is already encrypted
function isEncrypted(data) {
  return typeof data === 'object' && data !== null && data._encrypted === true
}

ipcMain.handle('store:get', async (event, key) => {
  try {
    const storePath = path.join(app.getPath('userData'), 'store.json')

    try {
      const data = await fs.readFile(storePath, 'utf-8')
      const store = JSON.parse(data)
      const value = store[key]

      // Check if this is encrypted data
      if (key === 'apiKeys' && isEncrypted(value)) {
        const decryptedJson = decryptData(value._data)
        if (decryptedJson) {
          return { success: true, value: JSON.parse(decryptedJson) }
        } else {
          return { success: false, error: 'Decryption failed' }
        }
      }

      // Check if we need to migrate old plain-text API keys
      if (key === 'apiKeys' && value && !isEncrypted(value)) {
        console.log('🔄 Migrating plain-text API keys to encrypted storage...')

        // Queue the migration write operation to prevent race conditions
        await new Promise((resolve) => {
          storeWriteQueue = storeWriteQueue
            .then(async () => {
              try {
                // Re-read to ensure we have latest data
                const freshData = await fs.readFile(storePath, 'utf-8')
                const freshStore = JSON.parse(freshData)

                // Encrypt and save the data
                const encryptedData = encryptData(JSON.stringify(value))
                if (encryptedData) {
                  freshStore[key] = {
                    _encrypted: true,
                    _version: 1,
                    _data: encryptedData
                  }
                  await fs.writeFile(storePath, JSON.stringify(freshStore, null, 2), 'utf-8')
                  console.log('✓ Migration complete - API keys now encrypted')
                } else {
                  console.error('✗ Migration failed - encryption not available')
                }
                resolve()
              } catch (error) {
                console.error('Migration error:', error)
                resolve()
              }
            })
            .catch(() => resolve())
        })
      }

      return { success: true, value }
    } catch (error) {
      // File doesn't exist or is empty
      return { success: true, value: null }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('store:set', async (event, key, value) => {
  // Queue this operation to prevent race conditions
  // Each operation waits for the previous one to complete
  const result = await new Promise((resolve) => {
    storeWriteQueue = storeWriteQueue
      .then(async () => {
        try {
          const storePath = path.join(app.getPath('userData'), 'store.json')

          let store = {}
          try {
            const data = await fs.readFile(storePath, 'utf-8')
            store = JSON.parse(data)
          } catch (error) {
            // File doesn't exist, start with empty store
          }

          // Encrypt API keys before storing
          if (key === 'apiKeys') {
            const encryptedData = encryptData(JSON.stringify(value))
            if (encryptedData) {
              store[key] = {
                _encrypted: true,
                _version: 1,
                _data: encryptedData
              }
            } else {
              resolve({ success: false, error: 'Encryption failed - DPAPI not available' })
              return
            }
          } else {
            // Non-sensitive data stored as-is
            store[key] = value
          }

          await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8')

          // Set file permissions to owner-only (Windows)
          try {
            await fs.chmod(storePath, 0o600)
          } catch (chmodError) {
            console.warn('Could not set file permissions:', chmodError.message)
          }

          resolve({ success: true })
        } catch (error) {
          resolve({ success: false, error: error.message })
        }
      })
      .catch((error) => {
        // Handle any unexpected errors in the queue
        resolve({ success: false, error: error.message })
      })
  })

  return result
})

ipcMain.handle('store:delete', async (event, key) => {
  try {
    const storePath = path.join(app.getPath('userData'), 'store.json')

    let store = {}
    try {
      const data = await fs.readFile(storePath, 'utf-8')
      store = JSON.parse(data)
    } catch (error) {
      return { success: true } // Already doesn't exist
    }

    delete store[key]
    await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8')

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('store:clear', async () => {
  try {
    const storePath = path.join(app.getPath('userData'), 'store.json')
    await fs.writeFile(storePath, '{}', 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Check if encryption is available
ipcMain.handle('store:isEncryptionAvailable', () => {
  return {
    success: true,
    available: safeStorage.isEncryptionAvailable(),
    platform: process.platform
  }
})

// ===== Open External Links =====
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ===== Window Controls for Custom Title Bar =====
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('window:isMaximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized()
  }
  return false
})

console.log('Electron main process started')
console.log('App data path:', app.getPath('userData'))
console.log('Dev mode:', isDev)
