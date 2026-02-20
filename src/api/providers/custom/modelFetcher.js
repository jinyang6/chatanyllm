import { REQUEST_TIMEOUT, formatContextWindow } from '@/core/model/ModelUtils'

/**
 * Fetch models from custom provider
 */
export async function fetchCustomProviderModels(providerConfig, apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const url = `${providerConfig.apiBaseUrl}${providerConfig.modelsEndpoint}`
    const headers = {
      'Content-Type': 'application/json'
    }

    // Build auth header based on configuration
    if (providerConfig.authHeaderKey && providerConfig.authHeaderValue) {
      const authValue = providerConfig.authHeaderValue.replace('{key}', apiKey)
      headers[providerConfig.authHeaderKey] = authValue
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key for custom provider.')
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please try again later.')
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()

    // Try to normalize the response (assume it has a data array or models array)
    const models = data.data || data.models || data

    if (!Array.isArray(models)) {
      throw new Error('Unexpected API response format')
    }

    return models.map(model => ({
      id: model.id || model.name,
      name: model.name || model.id,
      contextWindow: formatContextWindow(model.context_length || model.contextWindow || model.max_tokens),
      description: model.description || '',
      pricing: null
    }))
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection.')
    }
    throw error
  }
}
