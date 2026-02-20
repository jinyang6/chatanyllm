import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import { minimalSanitizeSchema } from '@/lib/sanitizeSchema'
import 'katex/dist/katex.min.css'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bot as BotIcon, User as UserIcon, RefreshCw as RefreshCwIcon, Pencil as PencilIcon, Check as CheckIcon, X as XIcon, Trash2 as Trash2Icon, Loader, LoaderCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'
import { AttachmentList } from '@/components/ui/AttachmentList'
import { ImagePreviewModal } from '@/components/ImagePreviewModal'
import { downloadImage, extractImageName } from '@/utils/imageDownload'

// ─── Module-scope pure utilities ─────────────────────────────────────────────

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

const formatModelName = (model) => {
  if (!model) return ''
  const parts = model.split('/')
  return parts[parts.length - 1]
}

// Compiled once at module load — not recreated on every render
const IMAGE_REGEX = /\[GENERATED_IMAGE:(.*?):END_IMAGE\]/gs

const parseGeneratedImages = (content) => {
  // Reset lastIndex since we reuse a global regex
  IMAGE_REGEX.lastIndex = 0
  const images = []
  let match
  while ((match = IMAGE_REGEX.exec(content)) !== null) {
    images.push(match[1])
  }
  const cleanContent = content.replace(IMAGE_REGEX, '').trim()
  return { cleanContent, images }
}

// ─── Simple function components for react-markdown ───────────────────────────

const CodeComponent = (props) => {
  const { inline, className, children, ref, ...rest } = props
  if (inline) {
    return (
      <code className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-300 dark:border-gray-600" {...rest}>
        {children}
      </code>
    )
  }
  return (
    <code className={className || ''} {...rest}>
      {children}
    </code>
  )
}

const PreComponent = (props) => {
  const { ref, children, ...rest } = props

  const getCodeText = () => {
    if (typeof children === 'string') return children
    if (children?.props?.children) {
      if (typeof children.props.children === 'string') {
        return children.props.children
      }
      if (Array.isArray(children.props.children)) {
        return children.props.children.join('')
      }
    }
    return ''
  }

  const codeText = getCodeText()

  return (
    <div className="relative group my-4">
      <pre className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 pr-12 rounded-lg overflow-x-auto max-w-full border border-gray-300 dark:border-gray-700" {...rest}>
        {children}
      </pre>
      {codeText && (
        <div className="absolute top-2 right-2 z-10">
          <CopyButton text={codeText} className="bg-background/90 hover:bg-background shadow-md border" />
        </div>
      )}
    </div>
  )
}

const createRefSafeComponent = (Tag) => (props) => {
  const { ref, node, ...rest } = props
  return <Tag {...rest} />
}

// ─── MemoizedMarkdownContent ──────────────────────────────────────────────────

const MemoizedMarkdownContent = memo(({ content, onImageClick }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[
        rehypeRaw,
        rehypeKatex,
        [rehypeSanitize, minimalSanitizeSchema]
      ]}
      remarkRehypeOptions={{
        allowDangerousHtml: true
      }}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 text-justify">{children}</p>,
        code: CodeComponent,
        pre: PreComponent,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/50 pl-4 italic my-3 text-gray-800 dark:text-gray-300">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border-collapse border border-border">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
        th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">{children}</th>,
        td: ({ children }) => <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{children}</td>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mt-3 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-semibold mt-3 mb-1 text-gray-900 dark:text-gray-100">{children}</h3>,
        h4: ({ children }) => <h4 className="text-base font-semibold mt-2 mb-1 text-gray-900 dark:text-gray-100">{children}</h4>,
        hr: () => <hr className="my-4 border-border" />,
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || 'Image'}
            className="max-w-full h-auto rounded-lg my-3 cursor-pointer hover:opacity-90 border border-border"
            onClick={() => onImageClick({ url: src, name: extractImageName(src, alt || 'markdown-image.png') })}
            onError={(e) => {
              console.error('Image failed to load. Src length:', src?.length, 'First 100 chars:', src?.substring(0, 100))
              e.target.style.display = 'none'
              e.target.insertAdjacentHTML('afterend',
                '<div class="text-sm text-red-500 p-2 border border-red-200 rounded bg-red-50">Image failed to load</div>'
              )
            }}
            loading="lazy"
          />
        ),
        div: createRefSafeComponent('div'),
        span: createRefSafeComponent('span'),
        b: createRefSafeComponent('b'),
        i: createRefSafeComponent('i'),
        strong: createRefSafeComponent('strong'),
        em: createRefSafeComponent('em'),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content && prevProps.onImageClick === nextProps.onImageClick
})

// ─── ThinkingSection ──────────────────────────────────────────────────────────

const ThinkingSection = memo(({ reasoning, isReasoningComplete, isExpanded, onToggle, scrollRef }) => {
  return (
    <div className="pb-3 mb-3 border-b border-border">
      {!isReasoningComplete ? (
        <>
          <Button
            variant="ghost"
            className="w-full justify-between mb-2 hover:bg-muted py-3 px-4"
            onClick={onToggle}
          >
            <div className="flex items-center gap-2">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span className="text-sm font-semibold opacity-80">Thinking</span>
              <span className="text-xs opacity-60">({reasoning.length} chars)</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>

          <div className="relative w-full">
            <ScrollArea
              className={isExpanded ? "h-[300px] w-full" : "h-[150px] w-full"}
              ref={scrollRef}
            >
              <div className="text-sm opacity-70 whitespace-pre-wrap break-words font-mono pr-3">
                {reasoning}
              </div>
            </ScrollArea>
          </div>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            className="w-full justify-between mb-2 hover:bg-muted py-3 px-4"
            onClick={onToggle}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold opacity-80">Thinking</span>
              <span className="text-xs opacity-60">({reasoning.length} chars)</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>

          {isExpanded && (
            <div className="relative w-full">
              <ScrollArea className="h-[300px] w-full">
                <div className="text-sm opacity-70 whitespace-pre-wrap break-words font-mono pr-3">
                  {reasoning}
                </div>
              </ScrollArea>
            </div>
          )}
        </>
      )}
    </div>
  )
})

// ─── MessageItem ──────────────────────────────────────────────────────────────

const MessageItem = memo(({
  message,
  isLastMessage,
  isLastUserMessage,
  isStreaming,
  isEditing,
  editContent,
  onEditContentChange,
  isDeleting,
  onDeleteClick,
  onCancelDelete,
  isCollapsed,
  onToggleCollapse,
  isThinkingExpanded,
  onToggleThinking,
  onRetry,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSetPreviewImage,
  thinkingScrollRef,
}) => {
  const isGenerating = isStreaming && isLastMessage && message.role === 'assistant'
  const modelName = formatModelName(message.model)

  const { cleanContent, images: generatedImages } = useMemo(
    () => parseGeneratedImages(message.content),
    [message.content]
  )

  return (
    <div
      className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-primary/10">
            <BotIcon className="h-5 w-5 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[80%] ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
        {/* Attachments strip */}
        <AttachmentList
          attachments={message.attachments}
          onPreview={onSetPreviewImage}
          compact
        />

        <Card
          className={`p-4 w-fit max-w-full overflow-hidden border-0 shadow-none ${
            message.role === 'user'
              ? 'bg-muted text-foreground'
              : 'bg-transparent text-card-foreground'
          }`}
        >
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => onEditContentChange(e.target.value)}
                className="min-h-[100px] bg-background text-foreground resize-none border-2 border-border"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelEdit}
                  className="h-8 bg-background text-foreground hover:bg-muted"
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onSaveEdit}
                  className="h-8 bg-green-600 text-white hover:bg-green-700 border-2 border-green-700 font-medium shadow-sm transition-colors"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Save & Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Thinking section */}
              {message.reasoning && message.reasoning.length > 0 && (
                <ThinkingSection
                  reasoning={message.reasoning}
                  isReasoningComplete={message.isReasoningComplete}
                  isExpanded={isThinkingExpanded}
                  onToggle={onToggleThinking}
                  scrollRef={thinkingScrollRef}
                />
              )}

              {/* Response content */}
              <div className="relative">
                <div className={`relative ${isCollapsed ? 'max-h-[120px] overflow-hidden' : ''}`}>
                  <div className="prose prose-lg max-w-none break-words prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-gray-900 dark:prose-li:marker:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100">
                    <MemoizedMarkdownContent content={cleanContent} onImageClick={onSetPreviewImage} />
                  </div>
                  {generatedImages.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {generatedImages.map((imageUrl, imgIndex) => (
                        <div key={imgIndex} className="rounded-lg border border-border overflow-hidden">
                          <img
                            src={imageUrl}
                            alt={`Generated Image ${imgIndex + 1}`}
                            className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => onSetPreviewImage({ url: imageUrl, name: `generated-${imgIndex + 1}.png` })}
                            onError={(e) => {
                              console.error('Generated image failed to load')
                              e.target.style.display = 'none'
                              e.target.insertAdjacentHTML('afterend',
                                '<div class="text-sm text-red-500 p-4">Image failed to load</div>'
                              )
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {isCollapsed && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/95 via-background/40 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Collapse/Expand button */}
              {cleanContent.length > 500 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-2 bg-background/60 hover:bg-accent border border-border/60 shadow-sm font-medium"
                  onClick={onToggleCollapse}
                >
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show More
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show Less
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </Card>

        {/* Generating indicator */}
        {isGenerating && (message.reasoning === '' ? cleanContent.length > 0 : message.isReasoningComplete) && (
          <div className="flex items-center gap-2 mt-3">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-sm font-semibold opacity-70">Generating response...</span>
          </div>
        )}

        {/* Message metadata */}
        <div className={`flex items-center gap-2 mt-2 text-xs text-muted-foreground ${
          message.role === 'user' ? 'justify-end' : 'justify-start'
        }`}>
          <span className="opacity-75">{formatTimestamp(message.timestamp)}</span>
          {message.role === 'assistant' && (message.provider || modelName) && (
            <>
              <span className="opacity-50">•</span>
              <span className="font-medium">
                {message.provider && <span className="opacity-75">{message.provider}/</span>}
                {modelName}
              </span>
            </>
          )}
          <CopyButton
            text={message.content}
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
          />
          {message.role === 'assistant' && onRetry && isLastMessage && !isEditing && !isGenerating && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={() => onRetry(message)}
            >
              <RefreshCwIcon className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}
          {isLastUserMessage && onStartEdit && !isEditing && !isStreaming && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={onStartEdit}
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {onDeleteClick && !isEditing && !isGenerating && (
            isDeleting ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs bg-red-600 text-white border-red-700 hover:bg-red-700 font-medium"
                  onClick={onDeleteClick}
                >
                  <Trash2Icon className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-muted"
                  onClick={onCancelDelete}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs hover:bg-red-100 hover:text-red-600 hover:border-red-300"
                onClick={onDeleteClick}
              >
                <Trash2Icon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )
          )}
        </div>
      </div>

      {message.role === 'user' && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="bg-primary">
            <UserIcon className="h-5 w-5 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Re-render only when something visible actually changed
  if (prevProps.message.content !== nextProps.message.content) return false
  if (prevProps.message.reasoning !== nextProps.message.reasoning) return false
  if (prevProps.message.isReasoningComplete !== nextProps.message.isReasoningComplete) return false
  if (prevProps.isStreaming !== nextProps.isStreaming) return false
  if (prevProps.isLastMessage !== nextProps.isLastMessage) return false
  if (prevProps.isLastUserMessage !== nextProps.isLastUserMessage) return false
  if (prevProps.isEditing !== nextProps.isEditing) return false
  if (prevProps.editContent !== nextProps.editContent) return false
  if (prevProps.isDeleting !== nextProps.isDeleting) return false
  if (prevProps.isCollapsed !== nextProps.isCollapsed) return false
  if (prevProps.isThinkingExpanded !== nextProps.isThinkingExpanded) return false
  return true
})

// ─── MessageList ──────────────────────────────────────────────────────────────

function MessageList({ messages, onRetry, onEditUserMessage, onDeleteMessage, isStreaming = false }) {
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const deleteTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const prevFirstMessageIdRef = useRef(null)
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

  // Auto-scroll to last message when conversation changes
  useEffect(() => {
    const firstMessageId = messages[0]?.id
    const isConversationChange = firstMessageId &&
      prevFirstMessageIdRef.current !== null &&
      prevFirstMessageIdRef.current !== firstMessageId

    if (isConversationChange && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }

    prevFirstMessageIdRef.current = firstMessageId
  }, [messages])

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
    <ScrollArea className="flex-1">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
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
