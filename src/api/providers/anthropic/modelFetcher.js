import { REQUEST_TIMEOUT, formatAnthropicName } from '@/core/model/ModelUtils'
import { getProviderById } from '@/config/providers'

/**
 * Fetch models from Anthropic Claude
 */
export async function fetchAnthropicModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const provider = getProviderById('anthropic')
  const baseUrl = provider.apiBaseUrl.replace(/\/$/, '')
  const endpoint = `${baseUrl}${provider.modelsEndpoint}`

  try {
    const response = await fetch(endpoint, {
      headers: {
        [provider.authHeaderKey]: apiKey,
        ...provider.extraHeaders
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your Anthropic API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please try again in a minute.')
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()

    // Anthropic returns models in data array
    return data.data.map(model => ({
      id: model.id,
      name: formatAnthropicName(model.display_name || model.id),
      contextWindow: '200k', // Anthropic models generally support 200k context
      description: model.id.includes('opus') ? 'Powerful model for complex reasoning'
        : model.id.includes('sonnet') ? 'Balanced performance and intelligence'
        : model.id.includes('haiku') ? 'Fast and efficient model'
        : '',
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
