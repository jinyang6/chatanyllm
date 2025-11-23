import { Button } from '@/components/ui/button'
import { RefreshCw as RefreshCwIcon, XCircle as XCircleIcon } from 'lucide-react'

export function ModelCatalog({
  providerId,
  fetchedModels,
  modelsFetchStatus,
  onFetchModels,
  size = 'default'
}) {
  const getLastFetchedTime = () => {
    const cached = fetchedModels[providerId]
    if (cached && cached.lastFetched) {
      const date = new Date(cached.lastFetched)
      const now = new Date()
      const diffMinutes = Math.floor((now - date) / 1000 / 60)

      if (diffMinutes < 1) return 'Just now'
      if (diffMinutes < 60) return `${diffMinutes}m ago`
      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    }
    return null
  }

  const getModelStatusColor = () => {
    const cached = fetchedModels[providerId]
    const fetchStatus = modelsFetchStatus[providerId] || {}

    if (fetchStatus.loading) return 'text-muted-foreground'
    if (fetchStatus.error) return 'text-red-500 dark:text-red-400'

    if (!cached?.models?.length || !cached.lastFetched) {
      return 'text-muted-foreground'
    }

    // Success: use default text color (simple!)
    return 'text-foreground'
  }

  const getStatusText = () => {
    const cached = fetchedModels[providerId]
    const fetchStatus = modelsFetchStatus[providerId] || {}
    const modelCount = cached?.models?.length || 0
    const lastFetched = getLastFetchedTime()

    if (fetchStatus.loading) {
      return 'Fetching models...'
    }
    if (fetchStatus.error) {
      return `Error: ${fetchStatus.error}`
    }
    if (modelCount > 0) {
      return `${modelCount} models • Updated ${lastFetched || 'just now'}`
    }
    return 'Click to fetch available models'
  }

  const getErrorInfo = () => {
    const fetchStatus = modelsFetchStatus[providerId] || {}

    if (!fetchStatus.error) return null

    const errorMessage = fetchStatus.error.toLowerCase()
    let title = 'Failed to fetch models'
    let description = fetchStatus.error

    if (errorMessage.includes('network') || errorMessage.includes('fetch failed') || errorMessage.includes('timeout')) {
      title = 'Network Error'
      description = 'Unable to connect. Check your connection.'
    } else if (errorMessage.includes('invalid') || errorMessage.includes('401') || errorMessage.includes('403')) {
      title = 'Invalid API Key'
      description = ''
    } else if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
      title = 'API Key Required'
      description = ''
    }

    return { title, description }
  }

  const fetchStatus = modelsFetchStatus[providerId] || {}
  const errorInfo = getErrorInfo()
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className={`space-y-2 ${size === 'sm' ? 'pt-2 border-t' : 'border rounded-lg p-4 bg-muted/30'}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className={`${textSize} font-medium`}>Model Catalog</h4>
          <p className={`text-xs ${getModelStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onFetchModels}
          disabled={fetchStatus.loading}
          className="shrink-0"
        >
          <RefreshCwIcon className={`${iconClass} ${size === 'sm' ? 'mr-1' : 'mr-2'} ${fetchStatus.loading ? 'animate-spin' : ''}`} />
          {fetchStatus.loading ? 'Fetching...' : 'Refresh Models'}
        </Button>
      </div>

      {errorInfo && (
        <div className={`flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 p-3 bg-red-50/50 dark:bg-red-950/20 ${size === 'sm' ? 'text-xs' : ''}`}>
          <XCircleIcon className={`${iconClass} mt-0.5 text-red-600 dark:text-red-500 flex-shrink-0`} />
          <div className="space-y-1">
            <p className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium text-red-900 dark:text-red-100`}>
              {errorInfo.title}
            </p>
            {errorInfo.description && (
              <p className="text-xs text-red-800 dark:text-red-200">
                {errorInfo.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
