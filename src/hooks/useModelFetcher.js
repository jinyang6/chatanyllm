import { useCallback } from 'react'
import { useProvider } from '@/contexts/ProviderContext'
import { fetchModelsForProvider } from '@/api/ModelFetcher'
import { getProviderById, getFallbackModels } from '@/config/providers'

// Error type constants
export const ERROR_TYPES = {
  NO_API_KEY: 'NO_API_KEY',
  INVALID_KEY: 'INVALID_KEY',
  NETWORK_ERROR: 'NETWORK_ERROR',
  OTHER_ERROR: 'OTHER_ERROR'
}

/**
 * Typed error class for API-level errors
 */
export class ApiError extends Error {
  constructor(message, type) {
    super(message)
    this.name = 'ApiError'
    this.type = type
  }
}

/**
 * Categorize error using standard web API patterns:
 * - error.status   → HTTP status code (attached by provider fetchers)
 * - error.name     → native DOMException name (AbortError = timeout)
 * - error.type     → our own ApiError type
 * - instanceof TypeError → fetch() network failure in browsers
 * Falls back to string matching only for unknown error sources.
 */
function categorizeError(error) {
  // Native network errors (browser standard)
  if (error.name === 'AbortError') return ERROR_TYPES.NETWORK_ERROR
  if (error instanceof TypeError) return ERROR_TYPES.NETWORK_ERROR

  // HTTP status codes (attached by provider fetchers, industry standard)
  if (error.status === 400 || error.status === 401 || error.status === 403) return ERROR_TYPES.INVALID_KEY

  // Our own ApiError type
  if (error.type) return error.type

  // Legacy fallback — string matching for errors without proper properties
  const message = error.message.toLowerCase()

  if (message.includes('api key not configured') || message.includes('api key is required')) {
    return ERROR_TYPES.NO_API_KEY
  }
  if (message.includes('invalid api key') || message.includes('401') || message.includes('403')) {
    return ERROR_TYPES.INVALID_KEY
  }

  return ERROR_TYPES.OTHER_ERROR
}

/**
 * Custom hook for fetching models from providers
 */
export function useModelFetcher() {
  const {
    apiKeys,
    customProviders,
    setModelsFetchLoading,
    setModelsFetchError,
    updateFetchedModels,
    getModelsForProvider
  } = useProvider()

  /**
   * Fetch models for a specific provider
   * @param {string} providerId - The provider ID
   * @param {boolean} forceRefresh - Force refresh even if cached
   * @returns {Promise<Array>} - Array of models
   */
  const fetchModels = useCallback(async (providerId, forceRefresh = false) => {
    // Check if we have cached models and they're fresh
    if (!forceRefresh) {
      const cached = getModelsForProvider(providerId)
      if (cached && cached.length > 0) {
        return cached
      }
    }

    // Get provider config
    const provider = getProviderById(providerId)
    const customProvider = customProviders.find(p => p.id === providerId)
    const providerConfig = provider || customProvider

    if (!providerConfig) {
      const error = new Error(`Provider ${providerId} not found`)
      setModelsFetchError(providerId, error.message, ERROR_TYPES.OTHER_ERROR)
      throw error
    }

    // Check if provider supports dynamic fetching
    if (providerConfig.supportsDynamicFetch === false) {
      // Return static models
      if (providerConfig.models) {
        updateFetchedModels(providerId, providerConfig.models)
        return providerConfig.models
      }
      const error = new Error(`Provider ${providerId} does not support dynamic model fetching`)
      setModelsFetchError(providerId, error.message, ERROR_TYPES.OTHER_ERROR)
      throw error
    }

    // Check if API key is available
    const apiKey = apiKeys[providerId]
    if (!apiKey) {
      const error = new ApiError('API key not configured. Please add your API key in Settings.', ERROR_TYPES.NO_API_KEY)
      setModelsFetchError(providerId, error.message, ERROR_TYPES.NO_API_KEY)
      throw error
    }

    // Set loading state
    setModelsFetchLoading(providerId, true)

    try {
      // Fetch models from API
      const models = await fetchModelsForProvider(
        providerId,
        apiKey,
        customProvider // Pass custom provider config if available
      )

      // Update context with fetched models
      updateFetchedModels(providerId, models)

      return models
    } catch (error) {
      // Categorize the error
      const errorType = categorizeError(error)

      // Set error state with categorization
      setModelsFetchError(providerId, error.message, errorType)

      throw error
    }
  }, [
    apiKeys,
    customProviders,
    getModelsForProvider,
    setModelsFetchLoading,
    setModelsFetchError,
    updateFetchedModels
  ])

  return { fetchModels }
}
