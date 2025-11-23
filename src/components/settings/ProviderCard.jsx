import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { XCircle as XCircleIcon } from 'lucide-react'
import { EncryptionBadge } from './EncryptionBadge'
import { TestConnectionButton } from './TestConnectionButton'
import { ModelCatalog } from './ModelCatalog'

export function ProviderCard({
  provider,
  apiKey,
  onApiKeyChange,
  encryptionStatus,
  testingConnection,
  connectionTestResult,
  connectionTestTimestamp,
  onTestConnection,
  fetchedModels,
  modelsFetchStatus,
  onFetchModels,
  showModelCatalog = true,
  size = 'default'
}) {
  const showTestButton = apiKey && provider.id !== 'anthropic'
  const showDynamicFetch = provider.supportsDynamicFetch && apiKey

  return (
    <div className="space-y-3">
      {/* API Key Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${provider.id}-key`} className="text-sm font-medium">
            API Key
          </Label>
          <EncryptionBadge encryptionStatus={encryptionStatus} />
        </div>
        <Input
          id={`${provider.id}-key`}
          type="password"
          placeholder="sk-..."
          value={apiKey || ''}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className="font-mono"
        />
      </div>

      {/* Test Connection Button */}
      {showTestButton && (
        <div className="space-y-2">
          <TestConnectionButton
            providerId={provider.id}
            isTesting={testingConnection}
            testResult={connectionTestResult}
            testTimestamp={connectionTestTimestamp}
            onTest={onTestConnection}
            size={size}
            className="w-full"
          />

          {/* Show alert only for errors - button color is sufficient for success */}
          {connectionTestResult && !connectionTestResult.success && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs flex items-start gap-2">
                <XCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium">{connectionTestResult.title}</div>
                  <div>{connectionTestResult.message}</div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Model Catalog */}
      {showModelCatalog && showDynamicFetch && (
        <ModelCatalog
          providerId={provider.id}
          fetchedModels={fetchedModels}
          modelsFetchStatus={modelsFetchStatus}
          onFetchModels={onFetchModels}
          size={size}
        />
      )}
    </div>
  )
}
