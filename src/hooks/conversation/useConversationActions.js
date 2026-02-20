import { ConversationRepository as conversationStorage } from '@/data/ConversationRepository'
import { v4 as uuidv4 } from 'uuid'
import { ConversationManager as conversationManager } from '@/core/chat/ConversationManager'

/**
 * Hook for core list operations (loading, sorting, deletion).
 */
export function useConversationActions(setConversations, conversationsRef, currentConversationId, setCurrentConversationId) {

  const createNewConversation = async () => {
    const newConv = conversationManager.createNewObject()
    try {
      await conversationStorage.save(newConv)
    } catch (e) {
      console.error('New conversation save error:', e)
    }
    setConversations(prev => [newConv, ...prev])
    return newConv
  }

  const updateConversationTitle = async (conversationId, newTitle) => {
    const conversation = conversationsRef.current.find(c => c.id === conversationId)
    if (!conversation) return

    const updated = {
      ...conversation,
      title: newTitle.trim() || 'New Conversation',
      updatedAt: new Date().toISOString()
    }

    try {
      await conversationStorage.save(updated)
    } catch (e) {
      console.error('Title save error:', e)
    }

    setConversations(prev =>
      conversationManager.sortByRecent(prev.map(c => c.id === conversationId ? updated : c))
    )
  }

  const deleteConversation = async (conversationId, isStreaming, stopStreaming) => {
    const result = await conversationStorage.delete(conversationId)
    if (!result.success) {
      console.error('Delete error:', result.error)
    }

    if (isStreaming(conversationId)) {
      stopStreaming(conversationId)
    }

    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== conversationId)
      if (conversationId === currentConversationId) {
        if (filtered.length > 0) {
          setCurrentConversationId(filtered[0].id)
        } else {
          createNewConversation().then(nc => setCurrentConversationId(nc.id))
        }
      }
      return filtered
    })
  }

  const addMessage = async (message, conversationId) => {
    const targetId = conversationId || currentConversationId
    const newMessage = {
      id: uuidv4(),
      role: message.role,
      content: message.content,
      reasoning: message.reasoning || '',
      isReasoningComplete: message.isReasoningComplete || false,
      timestamp: new Date().toISOString(),
      model: message.model || null,
      provider: message.provider || null,
      attachments: message.attachments || undefined
    }

    let conversationToSave = null
    setConversations(prev => {
      const conv = prev.find(c => c.id === targetId)
      if (!conv) return prev

      const updatedMessages = [...(conv.messages || []), newMessage]
      let title = conv.title
      if (title === 'New Conversation' && message.role === 'user') {
        title = conversationManager.generateTitle(message)
      }

      const updated = {
        ...conv,
        messages: updatedMessages,
        title,
        updatedAt: new Date().toISOString(),
        model: message.model || conv.model,
        provider: message.provider || conv.provider
      }
      conversationToSave = updated
      return conversationManager.sortByRecent(prev.map(c => c.id === targetId ? updated : c))
    })

    if (conversationToSave) {
      try {
        await conversationStorage.save(conversationToSave)
      } catch (e) {
        console.error('Add message save error:', e)
      }
    }
    return newMessage
  }

  const replaceMessages = async (newMessages) => {
    let conversationToSave = null
    setConversations(prev => {
      const conv = prev.find(c => c.id === currentConversationId)
      if (!conv) return prev
      const updated = {
        ...conv,
        messages: newMessages,
        updatedAt: new Date().toISOString()
      }
      conversationToSave = updated
      return conversationManager.sortByRecent(prev.map(c => c.id === currentConversationId ? updated : c))
    })

    if (conversationToSave) {
      try {
        await conversationStorage.save(conversationToSave)
      } catch (e) {
        console.error('Replace messages save error:', e)
      }
    }
  }

  const deleteMessage = async (messageId) => {
    const currentConv = conversationsRef.current.find(c => c.id === currentConversationId)
    if (!currentConv) return

    const newMessages = currentConv.messages.filter(m => m.id !== messageId)
    const updated = {
      ...currentConv,
      messages: newMessages,
      updatedAt: new Date().toISOString()
    }

    setConversations(prev =>
      conversationManager.sortByRecent(prev.map(c => c.id === currentConversationId ? updated : c))
    )

    try {
      await conversationStorage.save(updated)
    } catch (e) {
      console.error('Delete message save error:', e)
    }
  }

  return {
    createNewConversation,
    updateConversationTitle,
    deleteConversation,
    addMessage,
    replaceMessages,
    deleteMessage
  }
}
