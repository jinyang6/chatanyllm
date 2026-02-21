import { isElectron, getAppDataPath } from '@/platform/ElectronBridge'
import { fileSystem } from '@/platform/FileSystem'

const conversationWriteQueues = new Map()

export const ConversationRepository = {
  async getDataDir() {
    if (!isElectron()) return null
    const appDataPath = await getAppDataPath()
    return `${appDataPath}/conversations`
  },

  async list() {
    if (!isElectron()) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('conversation:'))
      return {
        success: true,
        conversations: keys.map(k => {
          try { return JSON.parse(localStorage.getItem(k)) } catch { return null }
        }).filter(Boolean)
      }
    }

    const dataDir = await this.getDataDir()
    await fileSystem.mkdir(dataDir)

    const result = await fileSystem.readDir(dataDir)
    if (!result.success) return result

    const conversations = []
    await Promise.all(result.files
      .filter(f => f.endsWith('.json'))
      .map(async (file) => {
        const read = await fileSystem.readFile(`${dataDir}/${file}`)
        if (!read.success) return
        try { conversations.push(JSON.parse(read.data)) } catch { /* skip corrupt */ }
      })
    )

    return { success: true, conversations }
  },

  async get(id) {
    if (!isElectron()) {
      const data = localStorage.getItem(`conversation:${id}`)
      return { success: !!data, conversation: data ? JSON.parse(data) : null }
    }

    const dataDir = await this.getDataDir()
    const filePath = `${dataDir}/${id}.json`
    const exists = await fileSystem.exists(filePath)
    if (!exists.exists) return { success: false, error: 'Conversation not found' }
    const read = await fileSystem.readFile(filePath)
    if (!read.success) return read
    try {
      return { success: true, conversation: JSON.parse(read.data) }
    } catch {
      return { success: false, error: 'Failed to parse conversation data' }
    }
  },

  async save(conversation) {
    if (!isElectron()) {
      localStorage.setItem(`conversation:${conversation.id}`, JSON.stringify(conversation))
      return { success: true }
    }

    if (!conversationWriteQueues.has(conversation.id)) {
      conversationWriteQueues.set(conversation.id, Promise.resolve())
    }

    return new Promise((resolve) => {
      const currentQueue = conversationWriteQueues.get(conversation.id)
      const newQueue = currentQueue.then(async () => {
        try {
          const dataDir = await this.getDataDir()
          await fileSystem.mkdir(dataDir)
          const writeResult = await fileSystem.writeFile(
            `${dataDir}/${conversation.id}.json`,
            JSON.stringify(conversation, null, 2)
          )
          resolve(writeResult)
        } catch (error) {
          resolve({ success: false, error: error.message || 'Failed to save conversation' })
        }
      })
      conversationWriteQueues.set(conversation.id, newQueue)
    })
  },

  async delete(id) {
    if (!isElectron()) {
      localStorage.removeItem(`conversation:${id}`)
      return { success: true }
    }

    const dataDir = await this.getDataDir()
    return fileSystem.deleteFile(`${dataDir}/${id}.json`)
  }
}

export default ConversationRepository
