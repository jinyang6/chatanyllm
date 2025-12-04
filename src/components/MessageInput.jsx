import { useState, useRef, useEffect } from 'react'
import { ArrowUp as ArrowUpIcon, CircleStop as StopIcon, Paperclip as PaperclipIcon, X as XIcon, FileText as FileIcon, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { formatFileSize } from '@/utils/messageFormatters'
import { convertImageToPNG, calculateBase64Size } from '@/utils/imageConverter'
import { toast } from 'sonner'

function MessageInput({ onSendMessage, isStreaming = false, onStopGeneration, disabled = false }) {
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState([])
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      // Set height to scrollHeight to fit content
      textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px' // Max 400px height
    }
  }, [message])

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled && !isStreaming) {
      textareaRef.current.focus()
    }
  }, [disabled, isStreaming])

  const handleSubmit = (e) => {
    e.preventDefault()
    if ((message.trim() || attachments.length > 0) && !isStreaming && !disabled) {
      onSendMessage(message, attachments)
      setMessage('')
      setAttachments([])
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e) => {
    // Enter without shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    // Cmd/Ctrl + Enter also sends
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleChange = (e) => {
    setMessage(e.target.value)
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault() // Prevent pasting image as text

        const file = item.getAsFile()
        if (!file) continue

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Image too large (max 10MB)')
          continue
        }

        try {
          // Convert to PNG format
          const pngDataUrl = await convertImageToPNG(file)

          // Create attachment
          const attachment = {
            id: Date.now().toString() + Math.random(),
            name: `pasted-${Date.now()}.png`,
            type: 'image/png',
            size: calculateBase64Size(pngDataUrl),
            data: pngDataUrl,
            isImage: true
          }

          setAttachments(prev => [...prev, attachment])
          // No success toast - silent operation
        } catch (error) {
          console.error('Paste error:', error)
          toast.error(`Failed to paste image: ${error.message || 'Unknown error'}`)
        }
      }
    }
  }

  const handleStop = (e) => {
    e.preventDefault()
    if (onStopGeneration) {
      onStopGeneration()
    }
  }

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const newAttachments = []

    for (const file of files) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }

      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const isImage = file.type.startsWith('image/')

      newAttachments.push({
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
        isImage
      })
    }

    setAttachments(prev => [...prev, ...newAttachments])

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveAttachment = (attachmentId) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId))
  }

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const isDisabled = disabled || isStreaming
  const canSend = (message.trim().length > 0 || attachments.length > 0) && !isDisabled

  return (
    <div className="border-t bg-background">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <form onSubmit={handleSubmit} className="relative">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <ScrollArea className="mb-3 w-full">
              <div className="flex flex-nowrap gap-2 pb-5 pt-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative group bg-muted rounded-lg p-2 flex items-center gap-2 min-w-[200px] max-w-[200px] flex-shrink-0"
                  >
                    {attachment.isImage ? (
                      <div className="relative">
                        <img
                          src={attachment.data}
                          alt={attachment.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      </div>
                    ) : (
                      <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 absolute -top-1.5 -right-1.5 bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          <div className="relative flex items-center gap-2 rounded-xl border-2 bg-background shadow-md transition-all focus-within:border-ring focus-within:shadow-lg p-3">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.h,.go,.rs,.rb,.php,.sql"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Attach Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleAttachClick}
                    size="icon"
                    variant="ghost"
                    disabled={isDisabled}
                    className="h-9 w-9 rounded-lg hover:bg-muted flex-shrink-0"
                  >
                    <PaperclipIcon className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Attach files (images, documents)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isStreaming
                  ? 'Waiting for response...'
                  : 'Send a message... (Shift+Enter for new line, Ctrl+V to paste images)'
              }
              disabled={isDisabled}
              className="min-h-[44px] max-h-[400px] resize-none border-0 bg-transparent px-4 py-3.5 text-base md:text-base font-normal text-black dark:text-white leading-[1.5] antialiased shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
              rows={1}
            />

            {/* Send/Stop Button */}
            {isStreaming ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      onClick={handleStop}
                      size="icon"
                      variant="destructive"
                      className="h-11 w-11 rounded-xl hover:bg-red-700 p-0 shadow-lg flex-shrink-0"
                    >
                      <StopIcon className="h-6 w-6" />
                      <span className="sr-only">Stop generation</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm font-medium">Stop generation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!canSend}
                      className="h-11 w-11 rounded-lg transition-all disabled:opacity-40 shadow-sm flex-shrink-0"
                    >
                      <ArrowUpIcon className="h-5 w-5" />
                      <span className="sr-only">Send message</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Send message (Enter)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Keyboard hints */}
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium opacity-100">
                Enter
              </kbd>{' '}
              to send
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium opacity-100">
                Shift
              </kbd>
              {' + '}
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium opacity-100">
                Enter
              </kbd>{' '}
              for new line
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MessageInput
