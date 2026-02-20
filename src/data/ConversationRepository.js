import { isElectron, getAppDataPath } from '@/platform/ElectronBridge'
import { fileSystem } from '@/platform/FileSystem'

/**
 * Service for managing conversation storage
 * Handles both Electron file system and Web localStorage backends
 */

// Write queue to prevent race conditions when multiple saves happen to same conversation
const conversationWriteQueues = new Map()

export const ConversationRepository = {
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

    // Filter JSON files and read them in parallel for faster loading
    const jsonFiles = result.files.filter(file => file.endsWith('.json'))

    if (jsonFiles.length === 0) {
      return { success: true, conversations: [] }
    }

    // Read all files in parallel
    const readPromises = jsonFiles.map(file =>
      fileSystem.readFile(`${dataDir}/${file}`)
    )
    const contents = await Promise.all(readPromises)

    // Parse all successfully read files
    const conversations = []
    contents.forEach((content, index) => {
      if (content.success) {
        try {
          conversations.push(JSON.parse(content.data))
        } catch (e) {
          console.error('Failed to parse conversation:', jsonFiles[index], e)
        }
      }
    })

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
    if (!isElectron()) {
      const key = `conversation:${id}`
      localStorage.removeItem(key)
      return { success: true }
    }

    const dataDir = await this.getDataDir()
    const filePath = `${dataDir}/${id}.json`
    const result = await fileSystem.deleteFile(filePath)
    return result
  }
}

export default ConversationRepository
