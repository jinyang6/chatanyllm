import { memo, useMemo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bot as BotIcon, User as UserIcon, RefreshCw as RefreshCwIcon, Pencil as PencilIcon, Check as CheckIcon, X as XIcon, Trash2 as Trash2Icon, Loader, LoaderCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'
import { AttachmentList } from '@/components/ui/attachment-list'
import { formatTimestamp, formatModelName, parseGeneratedImages } from './messageUtils'
import { MemoizedMarkdownContent } from './MarkdownContent'
import { ThinkingSection } from './ThinkingSection'
import { ResolvedImage } from './ResolvedImage'

// ─── MessageItem ──────────────────────────────────────────────────────────────

export const MessageItem = memo(({
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
                  <div className="prose prose-lg max-w-none break-words prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-gray-900 dark:prose-li:marker:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100 select-text">
                    <MemoizedMarkdownContent
                      content={message.role === 'user' ? cleanContent.replace(/\n/g, '\n\n') : cleanContent}
                      onImageClick={onSetPreviewImage}
                    />
                  </div>
                  {generatedImages.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {generatedImages.map((image, imgIndex) => (
                        <ResolvedImage
                          key={imgIndex}
                          image={image}
                          index={imgIndex}
                          onImageClick={onSetPreviewImage}
                        />
                      ))}
                    </div>
                  )}
                  {isCollapsed && (
                    <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t pointer-events-none ${message.role === 'user' ? 'from-muted/95 via-muted/40' : 'from-background/95 via-background/40'} to-transparent`} />
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
