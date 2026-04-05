import { ConversationRepository as conversationStorage } from '@/data/ConversationRepository'
import { v4 as uuidv4 } from 'uuid'
import { ConversationManager as conversationManager } from '@/core/chat/ConversationManager'

export function useConversationActions(setConversations, conversationsRef, currentConversationId, setCurrentConversationId) {

  const persistUpdate = async (updated, label) => {
    setConversations(prev => {
      if (prev[0]?.id === updated.id) {
        const next = [...prev]
        next[0] = updated
        return next
      }
      return [updated, ...prev.filter(c => c.id !== updated.id)]
    })
    try {
      await conversationStorage.save(updated)
    } catch (e) {
      console.error(`${label} save error:`, e)
    }
  }

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
    const conv = conversationsRef.current.find(c => c.id === conversationId)
    if (!conv) return
    await persistUpdate(
      { ...conv, title: newTitle.trim() || 'New Conversation', updatedAt: new Date().toISOString() },
      'Title'
    )
  }

  const deleteConversation = async (conversationId, isStreaming, stopStreaming) => {
    const result = await conversationStorage.delete(conversationId)
    if (!result.success) console.error('Delete error:', result.error)

    if (isStreaming(conversationId)) stopStreaming(conversationId)

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
    const conv = conversationsRef.current.find(c => c.id === targetId)
    if (!conv) return

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

    const title = conv.title === 'New Conversation' && message.role === 'user'
      ? conversationManager.generateTitle(message)
      : conv.title

    const updated = {
      ...conv,
      messages: [...(conv.messages || []), newMessage],
      title,
      updatedAt: new Date().toISOString(),
      model: message.model || conv.model,
      provider: message.provider || conv.provider
    }

    setConversations(prev => {
      if (prev[0]?.id === targetId) {
        const next = [...prev]
        next[0] = updated
        return next
      }
      return [updated, ...prev.filter(c => c.id !== targetId)]
    })
    try {
      await conversationStorage.save(updated)
    } catch (e) {
      console.error('Add message save error:', e)
    }

    return newMessage
  }

  const replaceMessages = async (newMessages) => {
    const conv = conversationsRef.current.find(c => c.id === currentConversationId)
    if (!conv) return
    await persistUpdate(
      { ...conv, messages: newMessages, updatedAt: new Date().toISOString() },
      'Replace messages'
    )
  }

  const deleteMessage = async (messageId) => {
    const conv = conversationsRef.current.find(c => c.id === currentConversationId)
    if (!conv) return
    await persistUpdate(
      { ...conv, messages: conv.messages.filter(m => m.id !== messageId), updatedAt: new Date().toISOString() },
      'Delete message'
    )
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
