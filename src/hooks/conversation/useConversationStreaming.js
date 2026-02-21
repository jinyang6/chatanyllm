import { useRef } from 'react'
import { STREAMING_CONSTANTS } from '@/constants/streaming'
import { ConversationRepository as conversationStorage } from '@/data/ConversationRepository'

/**
 * Hook for managing UI throttling, debounced saves, and stream abort handling.
 */
export function useConversationStreaming(setConversations, streamingConversationIds, setStreamingConversationIds) {
  const saveOperationsRef = useRef(new Map())
  const abortControllersRef = useRef(new Map())
  const abortedConversationIdsRef = useRef(new Set())
  const uiUpdateThrottleRef = useRef(new Map())

  const isConversationStreaming = (id) => streamingConversationIds.has(id)

  const startStreaming = (conversationId) => {
    const controller = new AbortController()
    abortControllersRef.current.set(conversationId, controller)
    setStreamingConversationIds(prev => new Set([...prev, conversationId]))
    return controller.signal
  }

  const stopStreaming = (conversationId, queuedSetConversations) => {
    // Clean up reasoning state
    queuedSetConversations(prev => {
      const conversation = prev.find(c => c.id === conversationId)
      if (!conversation) return prev
      const messages = conversation.messages || []
      if (messages.length === 0) return prev
      const lastMessage = messages[messages.length - 1]

      if (lastMessage.reasoning && !lastMessage.isReasoningComplete) {
        const updatedMessages = [...messages]
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          isReasoningComplete: true
        }
        const updated = { ...conversation, messages: updatedMessages }
        conversationStorage.save(updated).catch(e => console.error('Abort cleanup save error:', e))
        return prev.map(c => c.id === conversationId ? updated : c)
      }
      return prev
    })

    abortedConversationIdsRef.current.add(conversationId)
    const controller = abortControllersRef.current.get(conversationId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(conversationId)
    }

    // Cancel debounced saves
    const pendingSave = saveOperationsRef.current.get(conversationId)
    if (pendingSave) {
      clearTimeout(pendingSave.timeout)
      pendingSave.cancelled = true
      saveOperationsRef.current.delete(conversationId)
    }

    // Cancel throttled UI updates
    const pendingUI = uiUpdateThrottleRef.current.get(conversationId)
    if (pendingUI) {
      clearTimeout(pendingUI.timeout)
      uiUpdateThrottleRef.current.delete(conversationId)
    }

    setStreamingConversationIds(prev => {
      const next = new Set(prev)
      next.delete(conversationId)
      return next
    })

    setTimeout(() => {
      abortedConversationIdsRef.current.delete(conversationId)
    }, 100)
  }

  const performUIUpdate = (updateData, queuedSetConversations) => {
    const { content, saveImmediately, metadata, targetConversationId } = updateData

    queuedSetConversations(prev => {
      const updatedConversation = prev.find(c => c.id === targetConversationId)
      if (!updatedConversation) return prev
      const currentMessages = [...(updatedConversation.messages || [])]
      if (currentMessages.length === 0) return prev

      currentMessages[currentMessages.length - 1] = {
        ...currentMessages[currentMessages.length - 1],
        content,
        ...(metadata ? {
          timestamp: metadata.timestamp || currentMessages[currentMessages.length - 1].timestamp,
          model: metadata.model || currentMessages[currentMessages.length - 1].model,
          provider: metadata.provider || currentMessages[currentMessages.length - 1].provider,
          reasoning: ('reasoning' in metadata) ? metadata.reasoning : currentMessages[currentMessages.length - 1].reasoning,
          isReasoningComplete: ('isReasoningComplete' in metadata) ? metadata.isReasoningComplete : currentMessages[currentMessages.length - 1].isReasoningComplete
        } : {})
      }

      const updated = {
        ...updatedConversation,
        messages: currentMessages,
        ...(metadata?.model ? { model: metadata.model } : {}),
        ...(metadata?.provider ? { provider: metadata.provider } : {}),
        ...(saveImmediately ? { updatedAt: new Date().toISOString() } : {})
      }

      const existingSave = saveOperationsRef.current.get(targetConversationId)
      if (existingSave) {
        clearTimeout(existingSave.timeout)
        existingSave.cancelled = true
      }

      if (saveImmediately) {
        conversationStorage.save(updated).catch(e => console.error('Immediate save error:', e))
        saveOperationsRef.current.delete(targetConversationId)
      } else {
        const op = { cancelled: false, timeout: null }
        op.timeout = setTimeout(() => {
          if (!op.cancelled) {
            conversationStorage.save(updated).catch(e => console.error('Debounced save error:', e))
          }
          saveOperationsRef.current.delete(targetConversationId)
        }, STREAMING_CONSTANTS.SAVE_DEBOUNCE_MS)
        saveOperationsRef.current.set(targetConversationId, op)
      }

      const updatedArray = prev.map(c => c.id === targetConversationId ? updated : c)
      if (saveImmediately) {
        return updatedArray.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      }
      return updatedArray
    })
  }

  const updateLastMessage = (content, saveImmediately, metadata, conversationId, queuedSetConversations) => {
    if (abortedConversationIdsRef.current.has(conversationId)) return

    const updateData = { content, saveImmediately, metadata, targetConversationId: conversationId }

    if (saveImmediately) {
      const existing = uiUpdateThrottleRef.current.get(conversationId)
      if (existing) {
        clearTimeout(existing.timeout)
        uiUpdateThrottleRef.current.delete(conversationId)
      }
      performUIUpdate(updateData, queuedSetConversations)
    } else {
      const existing = uiUpdateThrottleRef.current.get(conversationId)
      if (existing) {
        existing.pendingData = updateData
      } else {
        const timeout = setTimeout(() => {
          const throttle = uiUpdateThrottleRef.current.get(conversationId)
          if (throttle) {
            performUIUpdate(throttle.pendingData, queuedSetConversations)
            uiUpdateThrottleRef.current.delete(conversationId)
          }
        }, STREAMING_CONSTANTS.UI_UPDATE_THROTTLE_MS)
        uiUpdateThrottleRef.current.set(conversationId, { timeout, pendingData: updateData })
      }
    }
  }

  return {
    isConversationStreaming,
    startStreaming,
    stopStreaming,
    updateLastMessage,
    getAbortSignal: (id) => abortControllersRef.current.get(id)?.signal || null,
    abortedConversationIdsRef
  }
}
