import { ConversationRepository as conversationStorage } from '@/data/ConversationRepository'
import { ConversationManager as conversationManager } from '@/core/chat/ConversationManager'

/**
 * Hook for loading and initializing the list.
 */
export function useConversationList(setConversations, setCurrentConversationId, setIsLoading, initializedRef, createNewConversation) {

  const loadConversations = async () => {
    if (initializedRef.current) return
    initializedRef.current = true

    try {
      const result = await conversationStorage.list()
      if (result.success && result.conversations.length > 0) {
        const sorted = conversationManager.sortByRecent(result.conversations)
        setConversations(sorted)
        setCurrentConversationId(sorted[0].id)
      } else {
        const newConv = await createNewConversation()
        setCurrentConversationId(newConv.id)
      }
    } catch (error) {
      console.error('List load error:', error)
      const newConv = await createNewConversation()
      setCurrentConversationId(newConv.id)
    } finally {
      setIsLoading(false)
    }
  }

  return { loadConversations }
}
