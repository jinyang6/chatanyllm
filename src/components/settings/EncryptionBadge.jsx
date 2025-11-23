import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Lock as LockIcon, ShieldAlert as ShieldAlertIcon } from 'lucide-react'

export function EncryptionBadge({ encryptionStatus }) {
  if (!encryptionStatus) return null

  if (encryptionStatus.available) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 cursor-help">
              <LockIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Encrypted with Windows DPAPI</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="p-1 cursor-help">
            <ShieldAlertIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">WARNING: Not encrypted</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
