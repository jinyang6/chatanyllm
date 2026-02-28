import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react'
import { useConversationStreaming } from '@/hooks/conversation/useConversationStreaming'
import { useConversationActions } from '@/hooks/conversation/useConversationActions'
import { useConversationList } from '@/hooks/conversation/useConversationList'

const ConversationContext = createContext(null)

/**
 * Global provider for conversation state.
 * Refactored to delegate specialized logic to independent hooks.
 */
export function ConversationProvider({ children }) {
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [streamingConversationIds, setStreamingConversationIds] = useState(new Set())

  const initializedRef = useRef(false)
  const stateUpdateQueueRef = useRef(Promise.resolve())
  const conversationsRef = useRef(conversations)

  // Keep conversationsRef logic for actions that need latest state in callbacks
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  // Derive messages from conversations
  const messages = useMemo(() => {
    if (!currentConversationId) return []
    const current = conversations.find(c => c.id === currentConversationId)
    return current?.messages || []
  }, [conversations, currentConversationId])

  // Single queue for state updates to prevent race conditions
  const queuedSetConversations = (updater) => {
    return new Promise((resolve) => {
      stateUpdateQueueRef.current = stateUpdateQueueRef.current.then(() => {
        return new Promise((innerResolve) => {
          setConversations(prev => {
            const result = updater(prev)
            setTimeout(() => {
              innerResolve()
              resolve()
            }, 0)
            return result
          })
        })
      })
    })
  }

  // Delegated Hooks
  const streaming = useConversationStreaming(
    setConversations,
    streamingConversationIds,
    setStreamingConversationIds
  )

  const actions = useConversationActions(
    setConversations,
    conversationsRef,
    currentConversationId,
    setCurrentConversationId
  )

  const list = useConversationList(
    setConversations,
    setCurrentConversationId,
    setIsLoading,
    initializedRef,
    actions.createNewConversation
  )

  // Initialization
  useEffect(() => {
    list.loadConversations()
  }, [])

  // Public Interface (mapping for backward compatibility)
  const value = {
    conversations,
    currentConversationId,
    messages,
    isLoading,
    streamingConversationIds,

    // Streaming operations
    isConversationStreaming: streaming.isConversationStreaming,
    startStreaming: streaming.startStreaming,
    stopStreaming: (id) => streaming.stopStreaming(id, queuedSetConversations),
    getAbortSignal: streaming.getAbortSignal,
    updateLastMessage: (c, s, m, id) => streaming.updateLastMessage(c, s, m, id || currentConversationId, queuedSetConversations),

    // Reasoning token streaming
    updateLastMessageReasoning: (reasoning, save, id) =>
      streaming.updateLastMessageReasoning(reasoning, id || currentConversationId, queuedSetConversations),
    markReasoningComplete: (id) =>
      streaming.markReasoningComplete(id || currentConversationId, queuedSetConversations),

    // Actions
    addMessage: (m, id) => actions.addMessage(m, id || currentConversationId),
    replaceMessages: actions.replaceMessages,
    deleteMessage: actions.deleteMessage,
    updateConversationTitle: actions.updateConversationTitle,
    deleteConversation: (id) => actions.deleteConversation(id, streaming.isConversationStreaming, (cid) => streaming.stopStreaming(cid, queuedSetConversations)),
    selectConversation: setCurrentConversationId,
    startNewConversation: async () => {
      const newConv = await actions.createNewConversation()
      setCurrentConversationId(newConv.id)
    },
    getCurrentConversation: () => conversations.find(c => c.id === currentConversationId),
    getConversationById: (id) => conversationsRef.current.find(c => c.id === id)
  }

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversation() {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider')
  }
  return context
}
