import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Copy as CopyIcon, Check as CheckIcon } from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

export function CopyButton({ text, className, variant = 'ghost', size = 'sm' }) {
  const { copied, copy } = useCopyToClipboard()

  const handleCopy = (e) => {
    e.preventDefault()
    copy(text)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleCopy}
            className={className}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-600" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            <span className="sr-only">{copied ? 'Copied!' : 'Copy to clipboard'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{copied ? 'Copied!' : 'Copy to clipboard'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
