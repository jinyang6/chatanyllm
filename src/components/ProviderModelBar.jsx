import { memo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from './SearchableSelect'
import { UpdateButton } from './UpdateButton'
import { PROVIDERS, getFallbackModels } from '@/config/providers'
import { useProvider } from '@/contexts/ProviderContext'
import { useModelFetcher, ERROR_TYPES } from '@/hooks/useModelFetcher'
import { useError } from '@/contexts/ErrorContext'
import { RefreshCw as RefreshCwIcon, AlertTriangle as AlertTriangleIcon, WifiOff as WifiOffIcon, Key as KeyIcon } from 'lucide-react'
import { getProviderById } from '@/config/providers'

const ProviderModelBar = memo(({ onOpenSettings }) => {
  const {
    provider,
    setProvider,
    model,
    setModel,
    getModelsForProvider,
    modelsFetchStatus,
    apiKeys,
    customProviders
  } = useProvider()
  const { fetchModels } = useModelFetcher()
  const { showMissingApiKeyAlert, showFetchErrorAlert, showInvalidApiKeyAlert } = useError()

  const allProviders = [...PROVIDERS, ...customProviders]
  const providerInfo = getProviderById(provider) || customProviders.find(p => p.id === provider)
  const hasApiKey = Boolean(apiKeys[provider])
  const needsApiKey = providerInfo && providerInfo.supportsDynamicFetch !== false

  const fetchStatus = modelsFetchStatus[provider] || { loading: false, error: null, errorType: null }
  const fetchedModels = getModelsForProvider(provider)
  const fallbackModels = getFallbackModels(provider)

  let currentModels = fetchedModels
  let usingFallback = false

  if (fetchedModels.length === 0) {
    if (fetchStatus.errorType === ERROR_TYPES.NO_API_KEY ||
        fetchStatus.errorType === ERROR_TYPES.INVALID_KEY ||
        (needsApiKey && !hasApiKey)) {
      currentModels = []
    } else if (fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR ||
               fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR) {
      currentModels = fallbackModels
      usingFallback = true
    } else {
      currentModels = fallbackModels
    }
  }

  const handleProviderChange = useCallback((value) => {
    setProvider(value)
    const cached = getModelsForProvider(value)
    const fallback = getFallbackModels(value)
    const models = cached.length > 0 ? cached : fallback
    if (models.length > 0) {
      setModel(models[0].id)
    }
  }, [setProvider, setModel, getModelsForProvider])

  const handleModelChange = useCallback((value) => {
    setModel(value)
  }, [setModel])

  const handleRefreshModels = useCallback(async () => {
    if (needsApiKey && !hasApiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    try {
      const models = await fetchModels(provider, true)
      if (models.length > 0 && !models.find(m => m.id === model)) {
        setModel(models[0].id)
      }
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Invalid API key')) {
        showInvalidApiKeyAlert(
          providerInfo.name,
          error.message,
          () => { if (onOpenSettings) onOpenSettings() }
        )
      } else {
        showFetchErrorAlert(
          providerInfo.name,
          error.message,
          () => handleRefreshModels()
        )
      }
    }
  }, [provider, model, hasApiKey, needsApiKey, providerInfo, fetchModels, setModel,
      showMissingApiKeyAlert, showInvalidApiKeyAlert, showFetchErrorAlert, onOpenSettings])

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/10">
      <div className="flex items-center justify-center gap-3">
        <SearchableSelect
          value={provider}
          onValueChange={handleProviderChange}
          options={allProviders}
          placeholder="Select provider..."
          searchPlaceholder="Search providers..."
          showDescription={true}
          className="h-10 text-base"
        />

        <Separator orientation="vertical" className="h-6" />

        <SearchableSelect
          value={model}
          onValueChange={handleModelChange}
          options={currentModels}
          placeholder={
            fetchStatus.loading
              ? 'Loading models...'
              : fetchStatus.errorType === ERROR_TYPES.NO_API_KEY
              ? 'Configure API key first'
              : fetchStatus.errorType === ERROR_TYPES.INVALID_KEY
              ? 'Invalid API key'
              : fetchStatus.error
              ? 'Error loading models'
              : currentModels.length === 0
              ? 'No models available'
              : 'Select model...'
          }
          searchPlaceholder="Search models..."
          showDescription={true}
          className="h-10 min-w-[180px] text-base"
          loading={fetchStatus.loading}
          error={fetchStatus.error}
        />

        {fetchStatus.errorType === ERROR_TYPES.NO_API_KEY && (
          <Badge variant="outline" className="text-red-600 border-red-600 h-10 px-3 text-sm">
            <KeyIcon className="h-4 w-4 mr-2" />
            API Key Required
          </Badge>
        )}
        {fetchStatus.errorType === ERROR_TYPES.INVALID_KEY && (
          <Badge variant="outline" className="text-red-600 border-red-600 h-10 px-3 text-sm">
            <AlertTriangleIcon className="h-4 w-4 mr-2" />
            Invalid API Key
          </Badge>
        )}
        {fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR && usingFallback && (
          <Badge variant="outline" className="text-blue-600 border-blue-600 h-10 px-3 text-sm">
            <WifiOffIcon className="h-4 w-4 mr-2" />
            Network Error - Using Fallback
          </Badge>
        )}
        {fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR && usingFallback && (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600 h-10 px-3 text-sm">
            <AlertTriangleIcon className="h-4 w-4 mr-2" />
            Using Fallback Models
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={handleRefreshModels}
          disabled={fetchStatus.loading}
          title="Refresh models"
        >
          <RefreshCwIcon className={`h-5 w-5 ${fetchStatus.loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <UpdateButton />
    </div>
  )
})

export default ProviderModelBar