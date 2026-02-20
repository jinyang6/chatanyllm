import { v4 as uuidv4 } from 'uuid'

/**
 * Service for conversation metadata and object structure operations.
 * Separates pure business logic from React state management.
 */

export const ConversationManager = {
  /**
   * Creates a default conversation object structure.
   */
  createNewObject(id = uuidv4()) {
    return {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: null,
      provider: null
    }
  },

  /**
   * Generates a title from the first message content.
   */
  generateTitle(firstMessage) {
    if (!firstMessage || !firstMessage.content) return 'New Conversation'

    const content = firstMessage.content.trim()

    // Take first 50 characters or until first newline
    const firstLine = content.split('\n')[0]
    const title = firstLine.length > 50
      ? firstLine.substring(0, 50) + '...'
      : firstLine

    return title || 'New Conversation'
  },

  /**
   * Sorts conversations by last updated time (most recent first).
   */
  sortByRecent(conversations) {
    return [...conversations].sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    )
  }
}

export default ConversationManager
