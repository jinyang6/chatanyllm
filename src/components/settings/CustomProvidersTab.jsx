import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus as PlusIcon, Trash as TrashIcon, Edit as EditIcon, Info as InfoIcon } from 'lucide-react'
import { ProviderCard } from './ProviderCard'

export function CustomProvidersTab({
  customProviders,
  apiKeys,
  setApiKeys,
  encryptionStatus,
  testingConnection,
  connectionTestResult,
  connectionTestTimestamp,
  onTestConnection,
  fetchedModels,
  modelsFetchStatus,
  onFetchModels,
  onAddProvider,
  onEditProvider,
  onDeleteProvider
}) {
  return (
    <div className="space-y-4 mt-4">
      {/* Fixed header - always visible */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Providers</h3>
          <p className="text-sm text-muted-foreground">
            Add your own LLM providers with custom API endpoints
          </p>
        </div>
        <Button onClick={onAddProvider}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Scrollable provider list */}
      <ScrollArea className="h-[350px] pr-4">
        {customProviders.length === 0 ? (
          <Alert>
            <InfoIcon className="h-5 w-5" />
            <AlertTitle>No Custom Providers</AlertTitle>
            <AlertDescription className="text-sm">
              You haven't added any custom providers yet. Click "Add Provider" to configure your own LLM API endpoint.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {customProviders.map((customProvider) => (
              <div
                key={customProvider.id}
                className="border rounded-lg p-4 space-y-3"
              >
                {/* Provider Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{customProvider.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        Custom
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {customProvider.apiBaseUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditProvider(customProvider)}
                      title="Edit provider"
                    >
                      <EditIcon className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteProvider(customProvider)}
                      title="Delete provider"
                    >
                      <TrashIcon className="h-5 w-5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Provider Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Endpoint:</span>{' '}
                    {customProvider.modelsEndpoint}
                  </div>
                  <div>
                    <span className="font-medium">Auth:</span>{' '}
                    {customProvider.authHeaderKey}
                  </div>
                </div>

                {/* Provider Card - handles API key, test connection, model catalog */}
                <ProviderCard
                  provider={customProvider}
                  apiKey={apiKeys[customProvider.id]}
                  onApiKeyChange={(value) => setApiKeys({ ...apiKeys, [customProvider.id]: value })}
                  encryptionStatus={encryptionStatus}
                  testingConnection={testingConnection[customProvider.id]}
                  connectionTestResult={connectionTestResult[customProvider.id]}
                  connectionTestTimestamp={connectionTestTimestamp[customProvider.id]}
                  onTestConnection={() => onTestConnection(customProvider.id)}
                  fetchedModels={fetchedModels}
                  modelsFetchStatus={modelsFetchStatus}
                  onFetchModels={() => onFetchModels(customProvider.id)}
                  showModelCatalog={true}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Fixed info alert - always visible */}
      <Alert>
        <InfoIcon className="h-5 w-5" />
        <AlertDescription className="text-xs">
          Custom providers must have an OpenAI-compatible API. The models endpoint should return
          a JSON response with a "data" array containing model objects with "id" and "name" fields.
        </AlertDescription>
      </Alert>
    </div>
  )
}
