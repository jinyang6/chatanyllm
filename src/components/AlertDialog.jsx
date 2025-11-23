import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, AlertTriangle as AlertTriangleIcon, Info as InfoIcon } from 'lucide-react'

/**
 * Reusable Alert Dialog Component
 * Shows modal alerts for errors, warnings, success, and info messages
 */
export function AlertDialog({
  open,
  onClose,
  type = 'info', // 'success', 'error', 'warning', 'info'
  title,
  message,
  details,
  primaryAction,
  secondaryAction,
  autoClose = null // milliseconds, null = no auto-close
}) {
  // Auto-close timer
  useEffect(() => {
    if (open && autoClose && autoClose > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, autoClose)

      return () => clearTimeout(timer)
    }
  }, [open, autoClose, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-destructive" />
      case 'warning':
        return <AlertTriangleIcon className="h-5 w-5 text-yellow-600" />
      case 'info':
      default:
        return <InfoIcon className="h-5 w-5 text-blue-600" />
    }
  }

  const getAlertVariant = () => {
    switch (type) {
      case 'error':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getIcon()}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            {message}
          </DialogDescription>
        </DialogHeader>

        {details && (
          <Alert variant={getAlertVariant()}>
            <AlertDescription className="text-sm">
              {details}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={() => {
                if (secondaryAction.handler) {
                  secondaryAction.handler()
                }
                onClose()
              }}
            >
              {secondaryAction.label || 'Cancel'}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant={type === 'error' ? 'destructive' : 'default'}
              onClick={() => {
                if (primaryAction.handler) {
                  primaryAction.handler()
                }
                onClose()
              }}
            >
              {primaryAction.label || 'OK'}
            </Button>
          )}
          {!primaryAction && !secondaryAction && (
            <Button onClick={onClose}>
              OK
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
