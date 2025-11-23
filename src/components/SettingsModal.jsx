import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Key as KeyIcon, Settings as SettingsIcon, Plus as PlusIcon } from 'lucide-react'
import { AddProviderDialog } from './AddProviderDialog'
import { PreferencesTab } from './settings/PreferencesTab'
import { ApiKeysTab } from './settings/ApiKeysTab'
import { CustomProvidersTab } from './settings/CustomProvidersTab'
import { PROVIDERS, getAllModels } from '@/config/providers'
import { useProvider } from '@/contexts/ProviderContext'
import { useModelFetcher, ERROR_TYPES } from '@/hooks/useModelFetcher'
import { useError } from '@/contexts/ErrorContext'
import { testApiConnection, validateBeforeTest } from '@/services/apiTester'
import { openExternal } from '@/lib/electron'

function SettingsModal({ onClose }) {
  const {
    provider,
    setProvider,
    model,
    setModel,
    apiKeys,
    setApiKeys,
    getModelsForProvider,
    modelsFetchStatus,
    fetchedModels,
    customProviders,
    removeCustomProvider,
    encryptionStatus
  } = useProvider()
  const { fetchModels } = useModelFetcher()
  const { showSuccess, showError, showWarning } = useError()

  const [showAddProvider, setShowAddProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState(null)
  const [testingConnection, setTestingConnection] = useState({})
  const [connectionTestResult, setConnectionTestResult] = useState({})
  const [connectionTestTimestamp, setConnectionTestTimestamp] = useState({})

  const allProviders = [...PROVIDERS, ...customProviders]

  // Get default models - same logic as ChatWindow
  const providerInfo = allProviders.find(p => p.id === provider)
  const hasApiKey = Boolean(apiKeys[provider])
  const needsApiKey = providerInfo && providerInfo.supportsDynamicFetch !== false
  const fetchStatus = modelsFetchStatus[provider] || { loading: false, error: null, errorType: null }

  // Determine default models based on error type and API key availability
  const fetchedDefaultModels = getModelsForProvider(provider)
  const fallbackDefaultModels = getAllModels(provider)

  let defaultModels = fetchedDefaultModels
  if (fetchedDefaultModels.length === 0) {
    // If no API key configured or invalid key, show empty array (no models)
    if (fetchStatus.errorType === ERROR_TYPES.NO_API_KEY ||
        fetchStatus.errorType === ERROR_TYPES.INVALID_KEY ||
        (needsApiKey && !hasApiKey)) {
      defaultModels = []
    }
    // For network errors or other errors, show fallback models
    else if (fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR ||
             fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR) {
      defaultModels = fallbackDefaultModels
    }
    // No error yet, use fallback as default
    else {
      defaultModels = fallbackDefaultModels
    }
  }

  const handleSave = async () => {
    // Auto-fetch models for providers with valid API keys
    for (const prov of allProviders) {
      if (apiKeys[prov.id] && prov.supportsDynamicFetch !== false) {
        try {
          await fetchModels(prov.id, false) // Don't force refresh, use cache if available
        } catch (error) {
          // Silently fail, user can manually refresh
          console.error(`Failed to fetch models for ${prov.name}:`, error)
        }
      }
    }

    showSuccess(
      'Settings Saved',
      'Your configuration has been saved successfully.'
    )
  }

  const handleTestConnection = async (providerId) => {
    // Get provider info
    const providerInfo = allProviders.find(p => p.id === providerId)
    const apiKey = apiKeys[providerId]
    const customProvider = customProviders.find(p => p.id === providerId)

    if (!providerInfo) return

    // Validate before testing
    const validation = validateBeforeTest(providerId, apiKey, customProvider)
    if (!validation.valid) {
      showError(
        'Cannot Test Connection',
        validation.errors[0],
        validation.errors.join('\n')
      )
      return
    }

    // Set testing state
    setTestingConnection({ ...testingConnection, [providerId]: true })
    setConnectionTestResult({ ...connectionTestResult, [providerId]: null })

    try {
      const result = await testApiConnection(providerId, apiKey, customProvider)

      // Store result
      setConnectionTestResult({
        ...connectionTestResult,
        [providerId]: result
      })

      // Track timestamp for fresh vs cached distinction
      if (result.success) {
        setConnectionTestTimestamp({
          ...connectionTestTimestamp,
          [providerId]: Date.now()
        })
      }

      // Show alert based on result
      if (result.success) {
        showSuccess(
          result.title,
          result.message,
          result.details,
          null
        )
      } else {
        showError(
          result.title,
          result.message,
          result.details
        )
      }
    } catch (error) {
      const errorResult = {
        success: false,
        message: 'Test failed',
        details: error.message
      }

      setConnectionTestResult({
        ...connectionTestResult,
        [providerId]: errorResult
      })

      showError(
        'Test Failed',
        'Could not test API connection.',
        error.message
      )
    } finally {
      setTestingConnection({ ...testingConnection, [providerId]: false })
    }
  }

  const handleFetchModels = async (providerId) => {
    try {
      await fetchModels(providerId, true) // Force refresh
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  const handleDeleteProvider = (customProvider) => {
    showWarning(
      'Delete Provider',
      `Are you sure you want to delete ${customProvider.name}?`,
      'This action cannot be undone. All associated data will be removed.',
      {
        primaryAction: {
          label: 'Delete',
          handler: () => {
            removeCustomProvider(customProvider.id)
            showSuccess(
              'Provider Deleted',
              `${customProvider.name} has been removed successfully.`
            )
          }
        },
        secondaryAction: {
          label: 'Cancel',
          handler: () => {}
        }
      }
    )
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <KeyIcon className="h-5 w-5" />
            <DialogTitle>API Configuration</DialogTitle>
          </div>
          <DialogDescription>
            Configure your API keys to start chatting with different AI models. Your keys are stored securely and never shared.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preferences">
              <SettingsIcon className="mr-2 h-5 w-5" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="apikeys">
              <KeyIcon className="mr-2 h-5 w-5" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="customproviders">
              <PlusIcon className="mr-2 h-5 w-5" />
              Custom Providers
            </TabsTrigger>
          </TabsList>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4 mt-4">
            <PreferencesTab
              provider={provider}
              setProvider={setProvider}
              model={model}
              setModel={setModel}
              allProviders={allProviders}
              defaultModels={defaultModels}
              fetchStatus={fetchStatus}
              getModelsForProvider={getModelsForProvider}
            />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="apikeys" className="space-y-4 mt-4">
            <ApiKeysTab
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              encryptionStatus={encryptionStatus}
              testingConnection={testingConnection}
              connectionTestResult={connectionTestResult}
              connectionTestTimestamp={connectionTestTimestamp}
              onTestConnection={handleTestConnection}
              fetchedModels={fetchedModels}
              modelsFetchStatus={modelsFetchStatus}
              onFetchModels={handleFetchModels}
              openExternal={openExternal}
            />
          </TabsContent>

          {/* Custom Providers Tab */}
          <TabsContent value="customproviders">
            <CustomProvidersTab
              customProviders={customProviders}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              encryptionStatus={encryptionStatus}
              testingConnection={testingConnection}
              connectionTestResult={connectionTestResult}
              connectionTestTimestamp={connectionTestTimestamp}
              onTestConnection={handleTestConnection}
              fetchedModels={fetchedModels}
              modelsFetchStatus={modelsFetchStatus}
              onFetchModels={handleFetchModels}
              onAddProvider={() => setShowAddProvider(true)}
              onEditProvider={(provider) => {
                setEditingProvider(provider)
                setShowAddProvider(true)
              }}
              onDeleteProvider={handleDeleteProvider}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add/Edit Provider Dialog */}
      <AddProviderDialog
        open={showAddProvider}
        onClose={() => {
          setShowAddProvider(false)
          setEditingProvider(null)
        }}
        editProvider={editingProvider}
      />
    </Dialog>
  )
}

export default SettingsModal
