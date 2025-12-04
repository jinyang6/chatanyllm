import { useState, useEffect, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import { minimalSanitizeSchema } from '@/lib/sanitizeSchema'
import 'katex/dist/katex.min.css'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bot as BotIcon, User as UserIcon, RefreshCw as RefreshCwIcon, Pencil as PencilIcon, Check as CheckIcon, X as XIcon, Trash2 as Trash2Icon, FileText as FileIcon, Loader, LoaderCircle, Copy as CopyIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'
import { formatFileSize } from '@/utils/messageFormatters'
import { ImagePreviewModal } from '@/components/ImagePreviewModal'
import { downloadImage, extractImageName } from '@/utils/imageDownload'

// Simple function components for react-markdown - filter out ref prop to avoid React 18 errors
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

  // Extract code text from children for copy functionality
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

// Ref-safe wrappers for common HTML elements that rehype-raw might add refs to
const createRefSafeComponent = (Tag) => (props) => {
  const { ref, node, ...rest } = props
  return <Tag {...rest} />
}

// Memoized markdown content component to prevent unnecessary re-parsing
const MemoizedMarkdownContent = memo(({ content }) => {
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
        // Custom component overrides for better styling
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
        img: ({ src, alt }) => {
          // Removed console.log for performance during rendering
          return (
            <img
              src={src}
              alt={alt || 'Image'}
              className="max-w-full h-auto rounded-lg my-3 cursor-pointer hover:opacity-90 border border-border"
              onClick={() => setPreviewImage({ url: src, name: extractImageName(src, alt || 'markdown-image.png') })}
              onError={(e) => {
                console.error('Image failed to load. Src length:', src?.length, 'First 100 chars:', src?.substring(0, 100))
                e.target.style.display = 'none'
                e.target.insertAdjacentHTML('afterend',
                  '<div class="text-sm text-red-500 p-2 border border-red-200 rounded bg-red-50">Image failed to load</div>'
                )
              }}
              loading="lazy"
            />
          )
        },
        // Ref-safe wrappers for elements that might receive refs from rehype-raw
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
  // Only re-render if content actually changed
  return prevProps.content === nextProps.content
})

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

  // Auto-scroll thinking section to show latest tokens (optimized with throttle)
  useEffect(() => {
    // Only run if streaming
    if (!isStreaming) return

    // Clear any pending scroll
    if (scrollThrottleRef.current) {
      clearTimeout(scrollThrottleRef.current)
    }

    // Throttle scroll updates to every 100ms
    scrollThrottleRef.current = setTimeout(() => {
      // Only scroll the last message if it has reasoning
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.reasoning && !lastMessage.isReasoningComplete && !expandedThinking.has(lastMessage.id)) {
        const scrollElement = thinkingScrollRefs.current.get(lastMessage.id)
        if (scrollElement) {
          // Auto-scroll to latest when in shrinked state during streaming
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
      // Only process each message once
      if (processedMessagesRef.current.has(message.id)) return

      // Mark as processed
      processedMessagesRef.current.add(message.id)

      // Auto-collapse user messages longer than 500 characters
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
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      })
    }

    prevFirstMessageIdRef.current = firstMessageId
  }, [messages])

  const handleDeleteClick = (messageId) => {
    if (deletingMessageId === messageId) {
      // Second click - confirm delete
      if (onDeleteMessage) {
        onDeleteMessage(messageId)
      }
      setDeletingMessageId(null)
    } else {
      // First click - show confirmation
      setDeletingMessageId(messageId)
    }
  }

  const handleCancelDelete = () => {
    setDeletingMessageId(null)
  }

  const handleToggleCollapse = (messageId) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  const handleToggleThinking = (messageId) => {
    setExpandedThinking(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

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
    // Extract just the model name (e.g., "grok-4-fast" from "x-ai/grok-4-fast")
    const parts = model.split('/')
    return parts[parts.length - 1]
  }

  // Extract generated images from content and return clean content + images array
  const parseGeneratedImages = (content) => {
    const imageRegex = /\[GENERATED_IMAGE:(.*?):END_IMAGE\]/gs
    const images = []
    let match

    while ((match = imageRegex.exec(content)) !== null) {
      images.push(match[1])
    }

    // Remove image markers from content
    const cleanContent = content.replace(imageRegex, '').trim()

    return { cleanContent, images }
  }

  const handleStartEdit = (message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditContent('')
  }

  const handleSaveEdit = (message) => {
    if (editContent.trim() && onEditUserMessage) {
      onEditUserMessage(message, editContent.trim())
    }
    setEditingMessageId(null)
    setEditContent('')
  }

  // Find the index of the last user message
  const lastUserMessageIndex = messages.reduce((lastIdx, msg, idx) => {
    return msg.role === 'user' ? idx : lastIdx
  }, -1)

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {messages.map((message, index) => {
          const modelName = formatModelName(message.model)
          const isEditing = editingMessageId === message.id
          const isLastUserMessage = message.role === 'user' && index === lastUserMessageIndex
          const isLastMessage = index === messages.length - 1
          const isGenerating = isStreaming && isLastMessage && message.role === 'assistant'
          const { cleanContent, images: generatedImages } = parseGeneratedImages(message.content)

          return (
            <div
              key={message.id}
              className={`flex gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    <BotIcon className="h-5 w-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] ${message.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                {/* Display attachments as list above card */}
                {message.attachments && message.attachments.length > 0 && (
                  <ScrollArea className="mb-2 w-full">
                    <div className="flex flex-nowrap gap-2 pb-5">
                      {message.attachments.map((attachment, attIndex) => (
                        <div
                          key={attIndex}
                          className="rounded-full px-3 py-1 flex items-center gap-2 bg-muted/60 border border-border flex-shrink-0"
                        >
                          {attachment.isImage ? (
                            <img
                              src={attachment.data}
                              alt={attachment.name}
                              className="h-5 w-5 object-cover rounded cursor-pointer hover:opacity-90"
                              onClick={() => setPreviewImage({ url: attachment.data, name: attachment.name })}
                            />
                          ) : (
                            <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate max-w-[150px]">{attachment.name}</span>
                          <span className="text-xs text-muted-foreground">({formatFileSize(attachment.size)})</span>
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
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
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px] bg-background text-foreground resize-none border-2 border-border"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="h-8 bg-background text-foreground hover:bg-muted"
                        >
                          <XIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(message)}
                          className="h-8 bg-green-600 text-white hover:bg-green-700 border-2 border-green-700 font-medium shadow-sm transition-colors"
                        >
                          <CheckIcon className="h-4 w-4 mr-1" />
                          Save & Regenerate
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Thinking section - shows reasoning tokens */}
                      {message.reasoning && message.reasoning.length > 0 && (
                        <div className="pb-3 mb-3 border-b border-border">
                          {!message.isReasoningComplete ? (
                            // During streaming: show shrinked (150px) by default, expandable to 300px
                            <>
                              {/* Header with expand/collapse button */}
                              <Button
                                variant="ghost"
                                className="w-full justify-between mb-2 hover:bg-muted py-3 px-4"
                                onClick={() => handleToggleThinking(message.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <LoaderCircle className="h-5 w-5 animate-spin" />
                                  <span className="text-sm font-semibold opacity-80">Thinking</span>
                                  <span className="text-xs opacity-60">({message.reasoning.length} chars)</span>
                                </div>
                                {expandedThinking.has(message.id) ? (
                                  <ChevronUp className="h-5 w-5" />
                                ) : (
                                  <ChevronDown className="h-5 w-5" />
                                )}
                              </Button>

                              {/* Thinking content - shrinked (150px) by default, or expanded (300px) */}
                              <div className="relative w-full">
                                <ScrollArea
                                  className={expandedThinking.has(message.id) ? "h-[300px] w-full" : "h-[150px] w-full"}
                                  ref={(el) => {
                                    if (el) {
                                      // Find the viewport element within the ScrollArea
                                      const viewport = el.querySelector('[data-radix-scroll-area-viewport]')
                                      if (viewport) {
                                        thinkingScrollRefs.current.set(message.id, viewport)
                                      }
                                    }
                                  }}
                                >
                                  <div className="text-sm opacity-70 whitespace-pre-wrap break-words font-mono pr-3">
                                    {message.reasoning}
                                  </div>
                                </ScrollArea>
                              </div>
                            </>
                          ) : (
                            // After completion: collapsed by default, expandable to 300px
                            <>
                              <Button
                                variant="ghost"
                                className="w-full justify-between mb-2 hover:bg-muted py-3 px-4"
                                onClick={() => handleToggleThinking(message.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold opacity-80">Thinking</span>
                                  <span className="text-xs opacity-60">({message.reasoning.length} chars)</span>
                                </div>
                                {expandedThinking.has(message.id) ? (
                                  <ChevronUp className="h-5 w-5" />
                                ) : (
                                  <ChevronDown className="h-5 w-5" />
                                )}
                              </Button>

                              {/* Thinking content - only shown when expanded */}
                              {expandedThinking.has(message.id) && (
                                <div className="relative w-full">
                                  <ScrollArea className="h-[300px] w-full">
                                    <div className="text-sm opacity-70 whitespace-pre-wrap break-words font-mono pr-3">
                                      {message.reasoning}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Response content */}
                      <div className="relative">
                      <div className={`relative ${collapsedMessages.has(message.id) ? 'max-h-[120px] overflow-hidden' : ''}`}>
                        <div className="prose prose-lg max-w-none break-words prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-gray-900 dark:prose-li:marker:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100">
                          <MemoizedMarkdownContent content={cleanContent} />
                        </div>
                        {/* Display generated images separately */}
                        {generatedImages.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {generatedImages.map((imageUrl, imgIndex) => (
                              <div key={imgIndex} className="rounded-lg border border-border overflow-hidden">
                                <img
                                  src={imageUrl}
                                  alt={`Generated Image ${imgIndex + 1}`}
                                  className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImage({ url: imageUrl, name: `generated-${imgIndex + 1}.png` })}
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
                        {/* Gradient fade when collapsed */}
                        {collapsedMessages.has(message.id) && (
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
                          onClick={() => handleToggleCollapse(message.id)}
                        >
                          {collapsedMessages.has(message.id) ? (
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
                {/* Generating indicator - show when generating content (either no reasoning or reasoning complete) */}
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
                  {/* Full message copy button - always visible */}
                  <CopyButton
                    text={message.content}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
                  />
                  {message.role === 'assistant' && onRetry && index === messages.length - 1 && !isEditing && !isGenerating && (
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
                  {isLastUserMessage && onEditUserMessage && !isEditing && !isStreaming && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleStartEdit(message)}
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {onDeleteMessage && !isEditing && !isGenerating && (
                    deletingMessageId === message.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs bg-red-600 text-white border-red-700 hover:bg-red-700 font-medium"
                          onClick={() => handleDeleteClick(message.id)}
                        >
                          <Trash2Icon className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs hover:bg-muted"
                          onClick={handleCancelDelete}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs hover:bg-red-100 hover:text-red-600 hover:border-red-300"
                        onClick={() => handleDeleteClick(message.id)}
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
        })}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* Image Preview Modal */}
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

// Memoize component to prevent unnecessary re-renders
// Only re-render if messages content actually changed
const arePropsEqual = (prevProps, nextProps) => {
  // Always re-render if streaming state changes
  if (prevProps.isStreaming !== nextProps.isStreaming) return false

  // If messages array length changed, re-render
  if (prevProps.messages.length !== nextProps.messages.length) return false

  // Check if last message content changed (for streaming updates)
  if (prevProps.messages.length > 0 && nextProps.messages.length > 0) {
    const prevLast = prevProps.messages[prevProps.messages.length - 1]
    const nextLast = nextProps.messages[nextProps.messages.length - 1]

    if (prevLast.content !== nextLast.content) return false
    if (prevLast.reasoning !== nextLast.reasoning) return false
    if (prevLast.isReasoningComplete !== nextLast.isReasoningComplete) return false
  }

  // Props are equal, skip re-render
  return true
}

export default memo(MessageList, arePropsEqual)
