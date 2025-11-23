import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info as InfoIcon, Plus as PlusIcon, Edit as EditIcon } from 'lucide-react'
import { useProvider } from '@/contexts/ProviderContext'
import { useError } from '@/contexts/ErrorContext'
import { PROVIDERS } from '@/config/providers'

export function AddProviderDialog({ open, onClose, editProvider = null }) {
  const { addCustomProvider, updateCustomProvider, apiKeys, setApiKeys, customProviders } = useProvider()
  const { showSuccess } = useError()

  const [formData, setFormData] = useState({
    name: '',
    apiBaseUrl: '',
    apiKey: ''
  })

  // Populate form when editing
  useEffect(() => {
    if (editProvider) {
      setFormData({
        name: editProvider.name,
        apiBaseUrl: editProvider.apiBaseUrl,
        apiKey: apiKeys[editProvider.id] || ''
      })
    } else {
      setFormData({
        name: '',
        apiBaseUrl: '',
        apiKey: ''
      })
    }
    setErrors({})
  }, [editProvider, apiKeys, open])

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Provider name is required'
    } else {
      // Generate provider ID from name (same logic as line 117)
      const providerId = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      // Normalize for comparison by removing ALL non-alphanumeric characters
      // This ensures "OPEN-ROUTER", "open router", "OpenRouter" all match "openrouter"
      const normalizeForComparison = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedInput = normalizeForComparison(formData.name)

      // Check against built-in providers (compare normalized forms)
      const isBuiltInConflict = PROVIDERS.some(p =>
        normalizeForComparison(p.id) === normalizedInput ||
        normalizeForComparison(p.name) === normalizedInput
      )

      if (isBuiltInConflict) {
        newErrors.name = 'This name conflicts with a built-in provider'
      }

      // Check against existing custom providers (normalize for comparison)
      const isCustomConflict = customProviders.some(p => {
        // Skip if editing the same provider
        if (editProvider && p.id === editProvider.id) return false

        // Compare normalized forms (checks both ID and name)
        return normalizeForComparison(p.id) === normalizedInput ||
               normalizeForComparison(p.name) === normalizedInput
      })

      if (isCustomConflict) {
        newErrors.name = 'A custom provider with this name already exists'
      }
    }

    if (!formData.apiBaseUrl.trim()) {
      newErrors.apiBaseUrl = 'API endpoint URL is required'
    } else {
      try {
        new URL(formData.apiBaseUrl)
      } catch (e) {
        newErrors.apiBaseUrl = 'Invalid URL format (must start with http:// or https://)'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    if (editProvider) {
      // Edit mode - update existing provider
      const updatedConfig = {
        name: formData.name,
        apiBaseUrl: formData.apiBaseUrl,
        description: 'Custom OpenAI-compatible provider',
        modelsEndpoint: '/models',
        authHeaderKey: 'Authorization',
        authHeaderValue: 'Bearer {key}',
        features: ['OpenAI-compatible API', 'Custom endpoint']
      }

      updateCustomProvider(editProvider.id, updatedConfig)

      // Update API key if changed
      if (formData.apiKey) {
        setApiKeys({ ...apiKeys, [editProvider.id]: formData.apiKey })
      }

      showSuccess(
        'Provider Updated',
        `${formData.name} has been updated successfully.`
      )
    } else {
      // Add mode - create new provider
      const providerId = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      const newProvider = {
        id: providerId,
        name: formData.name,
        description: 'Custom OpenAI-compatible provider',
        apiBaseUrl: formData.apiBaseUrl,
        modelsEndpoint: '/models',
        authHeaderKey: 'Authorization',
        authHeaderValue: 'Bearer {key}',
        supportsDynamicFetch: true,
        requiresApiKey: true,
        features: ['OpenAI-compatible API', 'Custom endpoint'],
        isCustom: true
      }

      addCustomProvider(newProvider)

      // Set API key if provided
      if (formData.apiKey) {
        setApiKeys({ ...apiKeys, [providerId]: formData.apiKey })
      }

      showSuccess(
        'Provider Added',
        `${formData.name} has been added successfully.`
      )
    }

    // Reset form
    setFormData({
      name: '',
      apiBaseUrl: '',
      apiKey: ''
    })
    setErrors({})

    onClose()
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {editProvider ? (
              <>
                <EditIcon className="h-5 w-5" />
                <DialogTitle>Edit Custom Provider</DialogTitle>
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5" />
                <DialogTitle>Add Custom Provider</DialogTitle>
              </>
            )}
          </div>
          <DialogDescription>
            {editProvider
              ? 'Update your OpenAI-compatible API provider configuration.'
              : 'Add an OpenAI-compatible API provider. Works with LM Studio, Ollama, Together AI, and other compatible services.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name" className="text-sm font-medium">
              Provider Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="provider-name"
              placeholder="e.g., LM Studio, Ollama, Together AI"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* API Endpoint URL */}
          <div className="space-y-2">
            <Label htmlFor="api-base-url" className="text-sm font-medium">
              API Endpoint URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="api-base-url"
              placeholder="https://api.example.com or http://localhost:1234"
              value={formData.apiBaseUrl}
              onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
              className={errors.apiBaseUrl ? 'border-destructive' : ''}
            />
            {errors.apiBaseUrl && (
              <p className="text-xs text-destructive">{errors.apiBaseUrl}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The base URL of your OpenAI-compatible API endpoint
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm font-medium">
              API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-... (optional, can be set later in Settings)"
              value={formData.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Some services like local LM Studio don't require an API key
            </p>
          </div>

          <Alert>
            <InfoIcon className="h-5 w-5" />
            <AlertDescription className="text-xs">
              This assumes OpenAI-compatible format with models at <code className="text-xs bg-muted px-1 py-0.5 rounded">/v1/models</code> and authentication via <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer</code> header.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {editProvider ? (
              <>
                <EditIcon className="h-5 w-5 mr-2" />
                Update Provider
              </>
            ) : (
              <>
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Provider
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
