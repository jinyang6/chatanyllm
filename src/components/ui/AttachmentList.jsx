import { memo } from 'react'
import { X as XIcon, FileText as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { formatFileSize } from '@/utils/messageFormatters'

/**
 * Shared attachment display component.
 *
 * compact=false (default): MessageInput preview strip — larger thumbnails, remove button on hover.
 * compact=true: MessageList read-only pill strip — small thumbnails, no remove.
 *
 * Attachment shape: { id, name, type, size, data, isImage }
 */
export const AttachmentList = memo(({ attachments, onRemove, onPreview, compact = false }) => {
  if (!attachments || attachments.length === 0) return null

  if (compact) {
    // Read-only pill style used in MessageList
    return (
      <ScrollArea className="mb-2 w-full">
        <div className="flex flex-nowrap gap-2 pb-5">
          {attachments.map((attachment, index) => (
            <div
              key={attachment.id ?? index}
              className="rounded-full px-3 py-1 flex items-center gap-2 bg-muted/60 border border-border flex-shrink-0"
            >
              {attachment.isImage ? (
                <img
                  src={attachment.data}
                  alt={attachment.name}
                  className="h-5 w-5 object-cover rounded cursor-pointer hover:opacity-90"
                  onClick={() => onPreview?.({ url: attachment.data, name: attachment.name })}
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
    )
  }

  // Full preview style used in MessageInput
  return (
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
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 absolute -top-1.5 -right-1.5 bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                onClick={() => onRemove(attachment.id)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
})
