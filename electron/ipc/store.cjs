const path = require('path')
const fs = require('fs/promises')

// Write queue shared across all store operations to prevent race conditions
let writeQueue = Promise.resolve()

function getStorePath(app) {
  return path.join(app.getPath('userData'), 'store.json')
}

async function readStore(storePath) {
  try {
    const data = await fs.readFile(storePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function writeStore(storePath, store) {
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8')
  try {
    await fs.chmod(storePath, 0o600)
  } catch (error) {
    console.warn('Could not set file permissions:', error.message)
  }
}

function enqueue(fn) {
  return new Promise((resolve) => {
    writeQueue = writeQueue.then(async () => {
      try {
        resolve(await fn())
      } catch (error) {
        resolve({ success: false, error: error.message })
      }
    })
  })
}

function encryptData(safeStorage, plainText) {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.encryptString(plainText).toString('base64')
  } catch (error) {
    console.error('Encryption failed:', error)
    return null
  }
}

function decryptData(safeStorage, encryptedBase64) {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
  } catch (error) {
    console.error('Decryption failed:', error)
    return null
  }
}

function isEncryptedValue(value) {
  return typeof value === 'object' && value !== null && value._encrypted === true
}

function wrapEncrypted(encryptedData) {
  return { _encrypted: true, _version: 1, _data: encryptedData }
}

function registerStoreHandlers(ipcMain, app, safeStorage) {
  ipcMain.handle('store:get', async (event, key) => {
    return enqueue(async () => {
      const storePath = getStorePath(app)
      const store = await readStore(storePath)
      const value = store[key]

      if (key === 'apiKeys' && isEncryptedValue(value)) {
        const decrypted = decryptData(safeStorage, value._data)
        if (!decrypted) return { success: false, error: 'Decryption failed' }
        return { success: true, value: JSON.parse(decrypted) }
      }

      // Migrate plain-text API keys to encrypted storage
      if (key === 'apiKeys' && value) {
        console.log('Migrating plain-text API keys to encrypted storage...')
        const encryptedData = encryptData(safeStorage, JSON.stringify(value))
        if (encryptedData) {
          store[key] = wrapEncrypted(encryptedData)
          await writeStore(storePath, store)
          console.log('Migration complete - API keys now encrypted')
        } else {
          console.error('Migration failed - encryption not available')
        }
      }

      return { success: true, value }
    })
  })

  ipcMain.handle('store:set', async (event, key, value) => {
    return enqueue(async () => {
      const storePath = getStorePath(app)
      const store = await readStore(storePath)

      if (key === 'apiKeys') {
        const encryptedData = encryptData(safeStorage, JSON.stringify(value))
        if (!encryptedData) return { success: false, error: 'Encryption failed - DPAPI not available' }
        store[key] = wrapEncrypted(encryptedData)
      } else {
        store[key] = value
      }

      await writeStore(storePath, store)
      return { success: true }
    })
  })

  ipcMain.handle('store:delete', async (event, key) => {
    return enqueue(async () => {
      const storePath = getStorePath(app)
      const store = await readStore(storePath)
      delete store[key]
      await writeStore(storePath, store)
      return { success: true }
    })
  })

  ipcMain.handle('store:clear', async () => {
    return enqueue(async () => {
      const storePath = getStorePath(app)
      await fs.writeFile(storePath, '{}', 'utf-8')
      return { success: true }
    })
  })

  ipcMain.handle('store:isEncryptionAvailable', () => ({
    success: true,
    available: safeStorage.isEncryptionAvailable(),
    platform: process.platform
  }))
}

module.exports = { registerStoreHandlers }
