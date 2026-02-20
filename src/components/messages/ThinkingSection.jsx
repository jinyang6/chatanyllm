import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoaderCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ─── ThinkingSection ──────────────────────────────────────────────────────────

export const ThinkingSection = memo(({ reasoning, isReasoningComplete, isExpanded, onToggle, scrollRef }) => {
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
