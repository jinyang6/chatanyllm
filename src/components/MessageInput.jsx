import { useState, useRef, useEffect } from 'react'
import { ArrowUp as ArrowUpIcon, CircleStop as StopIcon, Paperclip as PaperclipIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AttachmentList } from '@/components/ui/attachment-list'
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
      // Only expand if there's actual content, otherwise use minimum height
      if (message.length > 0) {
        textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px' // Max 400px height
      }
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
        toast.error(`${file.name} is too large (max 10MB)`)
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

  const handleAttachClick = (e) => {
    e.stopPropagation()
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleContainerClick = (e) => {
    textareaRef.current?.focus()
  }

  const isDisabled = disabled || isStreaming
  const canSend = (message.trim().length > 0 || attachments.length > 0) && !isDisabled

  return (
    <div className="absolute bottom-0 left-0 right-0">
      <form onSubmit={handleSubmit} className="relative flex flex-col mr-16">
          <div className="w-[90%] max-w-3xl min-w-[500px] mx-auto rounded-t-2xl border border-[#c4c4c4] dark:border-[#555] shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all p-3" style={{ backgroundColor: '#F2F2F2' }} onClick={handleContainerClick}>
            {/* Attachments Preview */}
            <AttachmentList
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />

            {/* Row: Textarea + Send */}
            <div className="relative flex items-center gap-2">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileSelect}
                className="hidden"
              />

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
                    : 'Send a message, Ctrl+V to paste images'
                }
                disabled={isDisabled}
                maxLength={16000}
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

            {/* Row: Attach Button below textarea */}
            <div className="flex items-start">
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
            </div>

            {/* Keyboard hints row */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
            </div>
          </div>
        </form>
    </div>
  )
}

export default MessageInput