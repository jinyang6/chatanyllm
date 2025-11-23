/**
 * Electron API wrapper for React components
 * Provides file system access and secure storage in desktop mode
 */

// Check if running in Electron
export const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron
}

// File System Operations
export const fileSystem = {
  async readFile(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.readFile(filePath)
  },

  async writeFile(filePath, content) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.writeFile(filePath, content)
  },

  async deleteFile(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.deleteFile(filePath)
  },

  async readDir(dirPath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.readDir(dirPath)
  },

  async exists(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.exists(filePath)
  },

  async mkdir(dirPath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.mkdir(dirPath)
  }
}

// Dialog Operations
export const dialog = {
  async openFile(options = {}) {
    if (!isElectron()) {
      throw new Error('Dialog is only available in desktop mode')
    }
    return window.electronAPI.dialog.openFile(options)
  },

  async saveFile(options = {}) {
    if (!isElectron()) {
      throw new Error('Dialog is only available in desktop mode')
    }
    return window.electronAPI.dialog.saveFile(options)
  }
}

// Secure Storage (for API keys, etc.)
export const store = {
  async get(key) {
    if (!isElectron()) {
      // Fallback to localStorage in web mode
      const value = localStorage.getItem(key)
      return { success: true, value: value ? JSON.parse(value) : null }
    }
    return window.electronAPI.store.get(key)
  },

  async set(key, value) {
    if (!isElectron()) {
      // Fallback to localStorage in web mode
      localStorage.setItem(key, JSON.stringify(value))
      return { success: true }
    }
    return window.electronAPI.store.set(key, value)
  },

  async delete(key) {
    if (!isElectron()) {
      localStorage.removeItem(key)
      return { success: true }
    }
    return window.electronAPI.store.delete(key)
  },

  async clear() {
    if (!isElectron()) {
      localStorage.clear()
      return { success: true }
    }
    return window.electronAPI.store.clear()
  }
}

// App Info
export const getAppDataPath = async () => {
  if (!isElectron()) {
    return null
  }
  return window.electronAPI.getAppDataPath()
}

export const getPlatform = () => {
  if (!isElectron()) {
    return 'web'
  }
  return window.electronAPI.platform
}

// Shell Operations
export const openExternal = async (url) => {
  if (!isElectron()) {
    // Fallback to window.open in web mode
    window.open(url, '_blank', 'noopener,noreferrer')
    return { success: true }
  }
  return window.electronAPI.shell.openExternal(url)
}

// Check if encryption is available
export const isEncryptionAvailable = async () => {
  if (!isElectron()) {
    return { available: false, platform: 'web' }
  }
  return window.electronAPI.store.isEncryptionAvailable()
}

// Conversation Storage Helpers
// Write queue to prevent race conditions when multiple saves happen to same conversation
const conversationWriteQueues = new Map()

export const conversations = {
  async getDataDir() {
    if (!isElectron()) {
      return null
    }
    const appDataPath = await getAppDataPath()
    return `${appDataPath}/conversations`
  },

  async list() {
    if (!isElectron()) {
      // Fallback to localStorage
      const keys = Object.keys(localStorage).filter(k => k.startsWith('conversation:'))
      return {
        success: true,
        conversations: keys.map(k => {
          try {
            return JSON.parse(localStorage.getItem(k))
          } catch (e) {
            return null
          }
        }).filter(Boolean)
      }
    }

    const dataDir = await this.getDataDir()
    const mkdirResult = await fileSystem.mkdir(dataDir)
    if (!mkdirResult.success) {
      return { success: false, error: mkdirResult.error }
    }

    const result = await fileSystem.readDir(dataDir)
    if (!result.success) {
      return result
    }

    const conversations = []
    for (const file of result.files) {
      if (file.endsWith('.json')) {
        const content = await fileSystem.readFile(`${dataDir}/${file}`)
        if (content.success) {
          try {
            conversations.push(JSON.parse(content.data))
          } catch (e) {
            console.error('Failed to parse conversation:', file, e)
          }
        }
      }
    }

    return { success: true, conversations }
  },

  async get(id) {
    if (!isElectron()) {
      const data = localStorage.getItem(`conversation:${id}`)
      return {
        success: !!data,
        conversation: data ? JSON.parse(data) : null
      }
    }

    const dataDir = await this.getDataDir()
    const filePath = `${dataDir}/${id}.json`

    const existsResult = await fileSystem.exists(filePath)
    if (!existsResult.exists) {
      return { success: false, error: 'Conversation not found' }
    }

    const result = await fileSystem.readFile(filePath)
    if (!result.success) {
      return result
    }

    try {
      return { success: true, conversation: JSON.parse(result.data) }
    } catch (e) {
      return { success: false, error: 'Failed to parse conversation data' }
    }
  },

  async save(conversation) {
    if (!isElectron()) {
      localStorage.setItem(`conversation:${conversation.id}`, JSON.stringify(conversation))
      return { success: true }
    }

    // Initialize write queue for this conversation if it doesn't exist
    if (!conversationWriteQueues.has(conversation.id)) {
      conversationWriteQueues.set(conversation.id, Promise.resolve())
    }

    // Queue this write operation to prevent concurrent writes to same conversation
    const result = await new Promise((resolve) => {
      const currentQueue = conversationWriteQueues.get(conversation.id)
      const newQueue = currentQueue.then(async () => {
        try {
          const dataDir = await this.getDataDir()
          await fileSystem.mkdir(dataDir)
          const filePath = `${dataDir}/${conversation.id}.json`
          const writeResult = await fileSystem.writeFile(filePath, JSON.stringify(conversation, null, 2))
          resolve(writeResult)
        } catch (error) {
          resolve({ success: false, error: error.message || 'Failed to save conversation' })
        }
      })
      conversationWriteQueues.set(conversation.id, newQueue)
    })

    return result
  },

  async delete(id) {
    console.log('Deleting conversation:', id)

    if (!isElectron()) {
      console.log('Using localStorage mode for deletion')
      const key = `conversation:${id}`
      console.log('Removing localStorage key:', key)
      localStorage.removeItem(key)
      console.log('localStorage deletion complete')
      return { success: true }
    }

    console.log('Using Electron file system for deletion')
    const dataDir = await this.getDataDir()
    const filePath = `${dataDir}/${id}.json`
    console.log('Deleting file:', filePath)
    const result = await fileSystem.deleteFile(filePath)
    console.log('File deletion result:', result)
    return result
  }
}

export default {
  isElectron,
  fileSystem,
  dialog,
  store,
  getAppDataPath,
  getPlatform,
  openExternal,
  isEncryptionAvailable,
  conversations
}
