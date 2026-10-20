import { memo, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LoaderCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDuration } from './messageUtils'

// ─── ThinkingSection ──────────────────────────────────────────────────────────

const ElapsedMetric = memo(({ reasoningLength, isGenerating, startedAt, metrics }) => {
  const [elapsedMs, setElapsedMs] = useState(() => {
    if (metrics?.durationMs != null) return metrics.durationMs
    if (!startedAt) return 0
    const start = new Date(startedAt).getTime()
    return Number.isFinite(start) ? Math.max(0, Date.now() - start) : 0
  })

  useEffect(() => {
    if (metrics?.durationMs != null) {
      setElapsedMs(metrics.durationMs)
      return
    }
    if (!isGenerating || !startedAt) return

    const start = new Date(startedAt).getTime()
    if (!Number.isFinite(start)) return

    const elapsedAtMount = Math.max(0, Date.now() - start)
    const perfAtMount = typeof performance !== 'undefined' ? performance.now() : null
    let timeoutId

    const tick = () => {
      const elapsed = perfAtMount != null
        ? elapsedAtMount + (performance.now() - perfAtMount)
        : Math.max(0, Date.now() - start)
      setElapsedMs(elapsed)

      const delay = elapsed < 10000
        ? 100
        : elapsed < 60000
          ? 500
          : elapsed < 3600000
            ? 1000
            : 60000
      timeoutId = setTimeout(tick, delay)
    }

    tick()
    return () => clearTimeout(timeoutId)
  }, [isGenerating, startedAt, metrics?.durationMs])

  const hasTimer = metrics?.durationMs != null || isGenerating
  const durationMs = metrics?.durationMs ?? elapsedMs

  if (!hasTimer) {
    return (
      <span className="text-xs opacity-60">{reasoningLength} chars</span>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs opacity-60 tabular-nums cursor-help">
            {formatDuration(durationMs)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {metrics?.ttftMs != null ? (
            <div className="tabular-nums">
              {formatDuration(durationMs)} ={' '}
              {formatDuration(metrics.ttftMs)} first token +{' '}
              {formatDuration(metrics.generationMs)} generation
            </div>
          ) : (
            <div className="tabular-nums">
              Total {formatDuration(durationMs)}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

export const ThinkingSection = memo(({
  reasoning,
  isReasoningComplete,
  isExpanded,
  onToggle,
  scrollRef,
  isGenerating = false,
  startedAt = null,
  metrics = null
}) => {
  const metric = (
    <ElapsedMetric
      reasoningLength={reasoning.length}
      isGenerating={isGenerating}
      startedAt={startedAt}
      metrics={metrics}
    />
  )

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
              {metric}
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
              {metric}
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
