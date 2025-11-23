import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Info as InfoIcon } from 'lucide-react'
import { SearchableSelect } from '../SearchableSelect'
import { ERROR_TYPES } from '@/hooks/useModelFetcher'

export function PreferencesTab({
  provider,
  setProvider,
  model,
  setModel,
  allProviders,
  defaultModels,
  fetchStatus,
  getModelsForProvider
}) {
  const handleProviderChange = (value) => {
    setProvider(value)
    const newProvider = allProviders.find(p => p.id === value)
    if (newProvider && newProvider.models && newProvider.models.length > 0) {
      setModel(newProvider.models[0].id)
    } else {
      // For providers without static models, get fetched models
      const cached = getModelsForProvider(value)
      if (cached.length > 0) {
        setModel(cached[0].id)
      }
    }
  }

  const getModelPlaceholder = () => {
    if (fetchStatus.loading) return 'Loading models...'
    if (fetchStatus.errorType === ERROR_TYPES.NO_API_KEY) return 'Configure API key first'
    if (fetchStatus.errorType === ERROR_TYPES.INVALID_KEY) return 'Invalid API key'
    if (fetchStatus.error) return 'Error loading models'
    if (defaultModels.length === 0) return 'No models available'
    return 'Select default model...'
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Default Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Set your preferred provider and model for new conversations. You can still change these during any conversation.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-provider" className="text-sm font-medium">
            Default Provider
          </Label>
          <SearchableSelect
            value={provider}
            onValueChange={handleProviderChange}
            options={allProviders}
            placeholder="Select default provider..."
            searchPlaceholder="Search providers..."
            showDescription={true}
            className="w-full justify-start"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-model" className="text-sm font-medium">
            Default Model
          </Label>
          <SearchableSelect
            value={model}
            onValueChange={setModel}
            options={defaultModels}
            placeholder={getModelPlaceholder()}
            searchPlaceholder="Search models..."
            showDescription={true}
            className="w-full justify-start"
          />
        </div>

        <Alert>
          <InfoIcon className="h-5 w-5" />
          <AlertTitle>About Defaults</AlertTitle>
          <AlertDescription className="text-sm">
            These settings will be used when you start a new conversation. You can always override them using the provider and model selectors at the top of any chat.
          </AlertDescription>
        </Alert>
      </div>
    </ScrollArea>
  )
}
