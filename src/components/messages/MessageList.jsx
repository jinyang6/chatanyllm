import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ImagePreviewModal } from '@/components/ImagePreviewModal'
import { downloadImage } from '@/utils/imageDownload'
import { MessageItem } from './MessageItem'

// ─── MessageList ──────────────────────────────────────────────────────────────

function MessageList({ messages, onRetry, onEditUserMessage, onDeleteMessage, isStreaming = false }) {
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const deleteTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const scrollAreaRef = useRef(null)
  const prevFirstMessageIdRef = useRef(null)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    }
  }, [])
  const [collapsedMessages, setCollapsedMessages] = useState(new Set())
  const [expandedThinking, setExpandedThinking] = useState(new Set())
  const processedMessagesRef = useRef(new Set())
  const thinkingScrollRefs = useRef(new Map())
  const scrollThrottleRef = useRef(null)
  const [previewImage, setPreviewImage] = useState(null)

  // Auto-scroll thinking section to show latest tokens (throttled)
  useEffect(() => {
    if (!isStreaming) return

    if (scrollThrottleRef.current) {
      clearTimeout(scrollThrottleRef.current)
    }

    scrollThrottleRef.current = setTimeout(() => {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.reasoning && !lastMessage.isReasoningComplete && !expandedThinking.has(lastMessage.id)) {
        const scrollElement = thinkingScrollRefs.current.get(lastMessage.id)
        if (scrollElement) {
          requestAnimationFrame(() => {
            scrollElement.scrollTop = scrollElement.scrollHeight
          })
        }
      }
    }, 100)

    return () => {
      if (scrollThrottleRef.current) {
        clearTimeout(scrollThrottleRef.current)
      }
    }
  }, [messages, expandedThinking, isStreaming])

  // Auto-collapse long messages when they first appear
  useEffect(() => {
    messages.forEach(message => {
      if (processedMessagesRef.current.has(message.id)) return
      processedMessagesRef.current.add(message.id)
      if (message.role === 'user' && message.content && message.content.length > 500) {
        setCollapsedMessages(prev => {
          const next = new Set(prev)
          next.add(message.id)
          return next
        })
      }
    })
  }, [messages])

  // Auto-cancel delete confirmation after 3 seconds
  useEffect(() => {
    if (deletingMessageId) {
      deleteTimeoutRef.current = setTimeout(() => {
        setDeletingMessageId(null)
      }, 3000)
    }
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current)
      }
    }
  }, [deletingMessageId])

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    const firstMessageId = messages[0]?.id
    const isConversationChange = firstMessageId &&
      prevFirstMessageIdRef.current !== null &&
      prevFirstMessageIdRef.current !== firstMessageId

    if (isConversationChange) {
      scrollToBottom('instant')
    }

    prevFirstMessageIdRef.current = firstMessageId
  }, [messages, scrollToBottom])

  const handleDeleteClick = useCallback((messageId) => {
    if (deletingMessageId === messageId) {
      if (onDeleteMessage) onDeleteMessage(messageId)
      setDeletingMessageId(null)
    } else {
      setDeletingMessageId(messageId)
    }
  }, [deletingMessageId, onDeleteMessage])

  const handleCancelDelete = useCallback(() => {
    setDeletingMessageId(null)
  }, [])

  const handleToggleCollapse = useCallback((messageId) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }, [])

  const handleToggleThinking = useCallback((messageId) => {
    setExpandedThinking(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }, [])

  const handleStartEdit = useCallback((message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setEditContent('')
  }, [])

  const handleSaveEdit = useCallback((message) => {
    if (editContent.trim() && onEditUserMessage) {
      onEditUserMessage(message, editContent.trim())
    }
    setEditingMessageId(null)
    setEditContent('')
  }, [editContent, onEditUserMessage])

  const handleSetPreviewImage = useCallback((img) => {
    setPreviewImage(img)
  }, [])

  // Index of the last user message — recalculated only when messages change
  const lastUserMessageIndex = useMemo(() => (
    messages.reduce((lastIdx, msg, idx) => msg.role === 'user' ? idx : lastIdx, -1)
  ), [messages])

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="h-full w-full">
        <div className="max-w-5xl mx-auto px-6 py-8 pb-36 space-y-8">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1
          const isLastUserMessage = message.role === 'user' && index === lastUserMessageIndex
          const isEditing = editingMessageId === message.id
          const isDeleting = deletingMessageId === message.id
          const isCollapsed = collapsedMessages.has(message.id)
          const isThinkingExpanded = expandedThinking.has(message.id)

          // Stable callback ref for the thinking scroll element
          const thinkingScrollRef = (el) => {
            if (el) {
              const viewport = el.querySelector('[data-radix-scroll-area-viewport]')
              if (viewport) thinkingScrollRefs.current.set(message.id, viewport)
            }
          }

          return (
            <MessageItem
              key={message.id}
              message={message}
              isLastMessage={isLastMessage}
              isLastUserMessage={isLastUserMessage}
              isStreaming={isStreaming}
              isEditing={isEditing}
              editContent={isEditing ? editContent : ''}
              onEditContentChange={setEditContent}
              isDeleting={isDeleting}
              onDeleteClick={onDeleteMessage ? () => handleDeleteClick(message.id) : null}
              onCancelDelete={handleCancelDelete}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => handleToggleCollapse(message.id)}
              isThinkingExpanded={isThinkingExpanded}
              onToggleThinking={() => handleToggleThinking(message.id)}
              onRetry={onRetry}
              onStartEdit={onEditUserMessage ? () => handleStartEdit(message) : null}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={() => handleSaveEdit(message)}
              onSetPreviewImage={handleSetPreviewImage}
              thinkingScrollRef={thinkingScrollRef}
            />
          )
        })}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      <ImagePreviewModal
        imageUrl={previewImage?.url}
        imageName={previewImage?.name}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        onDownload={downloadImage}
      />
    </ScrollArea>
    </div>
  )
}

// Only re-render MessageList when streaming state or message count/last message changes
const arePropsEqual = (prevProps, nextProps) => {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false
  if (prevProps.messages.length !== nextProps.messages.length) return false

  if (prevProps.messages.length > 0 && nextProps.messages.length > 0) {
    const prevLast = prevProps.messages[prevProps.messages.length - 1]
    const nextLast = nextProps.messages[nextProps.messages.length - 1]
    if (prevLast.content !== nextLast.content) return false
    if (prevLast.reasoning !== nextLast.reasoning) return false
    if (prevLast.isReasoningComplete !== nextLast.isReasoningComplete) return false
  }

  return true
}

export default memo(MessageList, arePropsEqual)
