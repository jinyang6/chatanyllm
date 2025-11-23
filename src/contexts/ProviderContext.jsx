import { createContext, useContext, useState, useEffect } from 'react'
import { store, isElectron, isEncryptionAvailable } from '@/lib/electron'

const ProviderContext = createContext(null)

// Helper to check if Electron is available
const useElectronStorage = isElectron()

export function ProviderProvider({ children }) {
  // Loading state to track initial data loading
  const [isLoading, setIsLoading] = useState(true)
  const [encryptionStatus, setEncryptionStatus] = useState(null)

  // Load initial state
  const [provider, setProvider] = useState('openrouter')
  const [model, setModel] = useState('openai/gpt-4-turbo')
  const [apiKeys, setApiKeys] = useState({
    openrouter: '',
    openai: '',
    gemini: ''
  })

  // Initialize from storage on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Check encryption availability first
        if (useElectronStorage) {
          try {
            const encStatus = await isEncryptionAvailable()
            setEncryptionStatus(encStatus)
            if (!encStatus.available) {
              console.error('⚠️ WARNING: Encryption not available!')
            }
          } catch (error) {
            console.error('Could not check encryption status:', error)
          }
        }

        if (useElectronStorage) {
          // Load from Electron secure storage
          const [providerResult, modelResult, apiKeysResult] = await Promise.all([
            store.get('defaultProvider'),
            store.get('defaultModel'),
            store.get('apiKeys')
          ])

          if (providerResult.success && providerResult.value) {
            setProvider(providerResult.value)
          }
          if (modelResult.success && modelResult.value) {
            setModel(modelResult.value)
          }
          if (apiKeysResult.success && apiKeysResult.value) {
            setApiKeys(apiKeysResult.value)
          }
        } else {
          // Load from localStorage
          const savedProvider = localStorage.getItem('defaultProvider')
          const savedModel = localStorage.getItem('defaultModel')
          const savedApiKeys = localStorage.getItem('apiKeys')

          if (savedProvider) setProvider(savedProvider)
          if (savedModel) setModel(savedModel)
          if (savedApiKeys) {
            try {
              setApiKeys(JSON.parse(savedApiKeys))
            } catch (e) {
              console.error('Failed to parse stored API keys:', e)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        // Always set loading to false when done
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // Fetched models state
  const [fetchedModels, setFetchedModels] = useState(() => {
    const stored = localStorage.getItem('fetchedModels')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse fetched models:', e)
      }
    }
    return {}
  })

  // Models fetch status
  const [modelsFetchStatus, setModelsFetchStatus] = useState({})

  // Custom providers added by user
  const [customProviders, setCustomProviders] = useState(() => {
    const stored = localStorage.getItem('customProviders')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse custom providers:', e)
      }
    }
    return []
  })

  // Persist to storage when values change
  useEffect(() => {
    // Don't save during initial load to prevent overwriting stored values
    if (isLoading) return

    const saveProvider = async () => {
      try {
        if (useElectronStorage) {
          await store.set('defaultProvider', provider)
        } else {
          localStorage.setItem('defaultProvider', provider)
        }
      } catch (error) {
        console.error('Failed to save provider:', error)
      }
    }
    saveProvider()
  }, [provider, isLoading])

  useEffect(() => {
    // Don't save during initial load to prevent overwriting stored values
    if (isLoading) return

    const saveModel = async () => {
      try {
        if (useElectronStorage) {
          await store.set('defaultModel', model)
        } else {
          localStorage.setItem('defaultModel', model)
        }
      } catch (error) {
        console.error('Failed to save model:', error)
      }
    }
    saveModel()
  }, [model, isLoading])

  useEffect(() => {
    // Don't save during initial load to prevent overwriting stored values
    if (isLoading) return

    const saveApiKeys = async () => {
      try {
        // Get list of valid provider IDs (built-in + active custom)
        const builtInProviders = ['openrouter', 'openai', 'gemini']
        const customProviderIds = customProviders.map(p => p.id)
        const validProviderIds = [...builtInProviders, ...customProviderIds]

        // Filter apiKeys to only include valid providers (removes orphaned keys)
        const cleanedKeys = validProviderIds.reduce((acc, id) => {
          acc[id] = apiKeys[id] || ''
          return acc
        }, {})

        const keyProviders = Object.keys(cleanedKeys).filter(key => cleanedKeys[key])
        console.log('💾 Saving API keys for providers:', keyProviders)
        console.log('🧹 Cleaned keys (total providers):', validProviderIds.length)

        if (useElectronStorage) {
          await store.set('apiKeys', cleanedKeys)
          console.log('✅ API keys encrypted and saved to store.json')
        } else {
          localStorage.setItem('apiKeys', JSON.stringify(cleanedKeys))
          console.log('✅ API keys saved to localStorage')
        }
      } catch (error) {
        console.error('❌ Failed to save API keys:', error)
      }
    }
    saveApiKeys()
  }, [apiKeys, customProviders, isLoading])

  useEffect(() => {
    localStorage.setItem('fetchedModels', JSON.stringify(fetchedModels))
  }, [fetchedModels])

  useEffect(() => {
    localStorage.setItem('customProviders', JSON.stringify(customProviders))
  }, [customProviders])

  const updateApiKey = (providerId, key) => {
    setApiKeys(prev => ({
      ...prev,
      [providerId]: key
    }))
  }

  const getModelsForProvider = (providerId) => {
    // Return fetched models if available and fresh (< 24 hours)
    const cached = fetchedModels[providerId]
    if (cached && cached.models && cached.lastFetched) {
      const age = Date.now() - cached.lastFetched
      const isStale = age > 24 * 60 * 60 * 1000 // 24 hours
      if (!isStale) {
        return cached.models
      }
    }
    return []
  }

  const setModelsFetchLoading = (providerId, loading) => {
    setModelsFetchStatus(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], loading }
    }))
  }

  const setModelsFetchError = (providerId, error, errorType = 'OTHER_ERROR') => {
    setModelsFetchStatus(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], loading: false, error, errorType }
    }))
  }

  const updateFetchedModels = (providerId, models) => {
    setFetchedModels(prev => ({
      ...prev,
      [providerId]: {
        models,
        lastFetched: Date.now(),
        error: null
      }
    }))
    setModelsFetchStatus(prev => ({
      ...prev,
      [providerId]: { loading: false, error: null }
    }))
  }

  const clearModelsCache = (providerId) => {
    setFetchedModels(prev => {
      const updated = { ...prev }
      delete updated[providerId]
      return updated
    })
  }

  const addCustomProvider = (providerConfig) => {
    setCustomProviders(prev => [...prev, providerConfig])
  }

  const updateCustomProvider = (providerId, updatedConfig) => {
    setCustomProviders(prev =>
      prev.map(p => p.id === providerId ? { ...p, ...updatedConfig } : p)
    )
    // Clear cache when provider config changes
    clearModelsCache(providerId)
  }

  const removeCustomProvider = (providerId) => {
    setCustomProviders(prev => prev.filter(p => p.id !== providerId))
    clearModelsCache(providerId)

    // Remove API key for deleted provider
    setApiKeys(prev => {
      const updated = { ...prev }
      delete updated[providerId]
      return updated
    })
  }

  const value = {
    provider,
    setProvider,
    model,
    setModel,
    apiKeys,
    setApiKeys,
    updateApiKey,
    fetchedModels,
    modelsFetchStatus,
    customProviders,
    isLoading,
    encryptionStatus,
    getModelsForProvider,
    setModelsFetchLoading,
    setModelsFetchError,
    updateFetchedModels,
    clearModelsCache,
    addCustomProvider,
    updateCustomProvider,
    removeCustomProvider
  }

  return (
    <ProviderContext.Provider value={value}>
      {children}
    </ProviderContext.Provider>
  )
}

export function useProvider() {
  const context = useContext(ProviderContext)
  if (!context) {
    throw new Error('useProvider must be used within a ProviderProvider')
  }
  return context
}
