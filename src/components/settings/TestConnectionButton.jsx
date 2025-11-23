import { Button } from '@/components/ui/button'
import { CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, Loader2 as LoaderIcon } from 'lucide-react'

export function TestConnectionButton({
  providerId,
  isTesting,
  testResult,
  testTimestamp,
  onTest,
  size = 'default',
  className = ''
}) {
  // Get button style based on test age (fresh vs cached success)
  const getButtonStyle = () => {
    if (!testResult) return { variant: 'outline', className: '' }
    if (!testResult.success) return { variant: 'destructive', className: '' }

    // Success - check if recent (< 30 seconds)
    const ageSeconds = testTimestamp ? (Date.now() - testTimestamp) / 1000 : 9999

    if (ageSeconds < 30) {
      // Fresh success - solid emerald
      return {
        variant: 'default',
        className: 'bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600'
      }
    }

    // Cached success - emerald outline
    return {
      variant: 'outline',
      className: 'border-emerald-500 text-emerald-600 hover:border-emerald-600 dark:border-emerald-400 dark:text-emerald-400 dark:hover:border-emerald-500'
    }
  }

  const style = getButtonStyle()
  const iconClass = size === 'sm' ? 'h-4 w-4 mr-2' : 'h-5 w-5 mr-2'

  return (
    <Button
      variant={style.variant}
      size={size}
      className={`${style.className} ${className}`}
      onClick={onTest}
      disabled={isTesting}
    >
      {isTesting ? (
        <>
          <LoaderIcon className={`${iconClass} animate-spin`} />
          {size === 'sm' ? 'Testing...' : 'Testing Connection...'}
        </>
      ) : testResult ? (
        testResult.success ? (
          <>
            <CheckCircleIcon className={iconClass} />
            {size === 'sm' ? 'Success' : 'Connection Successful'}
          </>
        ) : (
          <>
            <XCircleIcon className={iconClass} />
            {size === 'sm' ? 'Failed' : 'Test Failed'}
          </>
        )
      ) : (
        <>
          <CheckCircleIcon className={iconClass} />
          Test Connection
        </>
      )}
    </Button>
  )
}
