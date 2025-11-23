import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExternalLink as ExternalLinkIcon, Info as InfoIcon } from 'lucide-react'
import { ProviderCard } from './ProviderCard'
import { PROVIDERS } from '@/config/providers'

export function ApiKeysTab({
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
  openExternal
}) {
  return (
    <Tabs defaultValue="openrouter" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        {PROVIDERS.map((provider) => (
          <TabsTrigger key={provider.id} value={provider.id}>
            {provider.name.split(' ')[0]}
          </TabsTrigger>
        ))}
      </TabsList>

      {PROVIDERS.map((provider) => (
        <TabsContent key={provider.id} value={provider.id} className="space-y-4 mt-4">
          {/* Provider Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{provider.name}</h3>
              {provider.badge && (
                <Badge variant={provider.badgeVariant}>
                  {provider.badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {provider.description}
            </p>
          </div>

          {/* Provider Card - handles API key, test connection, model catalog */}
          <ProviderCard
            provider={provider}
            apiKey={apiKeys[provider.id]}
            onApiKeyChange={(value) => setApiKeys({ ...apiKeys, [provider.id]: value })}
            encryptionStatus={encryptionStatus}
            testingConnection={testingConnection[provider.id]}
            connectionTestResult={connectionTestResult[provider.id]}
            connectionTestTimestamp={connectionTestTimestamp[provider.id]}
            onTestConnection={() => onTestConnection(provider.id)}
            fetchedModels={fetchedModels}
            modelsFetchStatus={modelsFetchStatus}
            onFetchModels={() => onFetchModels(provider.id)}
            showModelCatalog={true}
            size="default"
          />

          {/* Get API Key Link */}
          <div
            onClick={() => openExternal(provider.apiKeyUrl)}
            className="flex items-start gap-3 rounded-lg border p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <ExternalLinkIcon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Need an API key?</p>
              <p className="text-sm text-muted-foreground">
                Click here to get your API key from {provider.name}
              </p>
            </div>
          </div>

          {/* Note for providers without dynamic fetch */}
          {!provider.supportsDynamicFetch && (
            <Alert>
              <InfoIcon className="h-5 w-5" />
              <AlertDescription className="text-sm">
                {provider.name} uses a curated model list. Models are updated automatically.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
