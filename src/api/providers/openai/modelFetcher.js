import { REQUEST_TIMEOUT, formatModelName } from '@/core/model/ModelUtils'
import { getProviderById } from '@/config/providers'

/**
 * Fetch models from OpenAI
 */
export async function fetchOpenAIModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const provider = getProviderById('openai')
  const baseUrl = provider.apiBaseUrl.replace(/\/$/, '')
  const endpoint = `${baseUrl}${provider.modelsEndpoint}`

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your OpenAI API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please try again in a minute.')
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()

    // Filter for GPT models and sort
    return data.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        name: formatModelName(model.id),
        contextWindow: getOpenAIContextWindow(model.id),
        description: getOpenAIDescription(model.id),
        pricing: null
      }))
      .sort((a, b) => b.id.localeCompare(a.id)) // Newer models first
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection.')
    }
    throw error
  }
}

export function getOpenAIContextWindow(modelId) {
  const contextWindows = {
    'gpt-4o': '128k',
    'gpt-4o-mini': '128k',
    'o3-mini': '128k',
    'o1': '128k',
    'o1-preview': '128k',
    'o1-mini': '128k',
    'gpt-4-turbo': '128k',
    'gpt-4-turbo-preview': '128k',
    'gpt-4-1106-preview': '128k',
    'gpt-4-0125-preview': '128k',
    'gpt-4': '8k',
    'gpt-4-0613': '8k',
    'gpt-4-32k': '32k',
    'gpt-3.5-turbo': '16k',
    'gpt-3.5-turbo-16k': '16k',
    'gpt-3.5-turbo-1106': '16k',
    'gpt-3.5-turbo-0125': '16k'
  }

  // Try exact match first
  if (contextWindows[modelId]) return contextWindows[modelId]

  // Try partial match
  for (const [key, value] of Object.entries(contextWindows)) {
    if (modelId.includes(key)) return value
  }

  return '8k' // Default
}

export function getOpenAIDescription(modelId) {
  if (modelId.includes('gpt-4o-mini')) return 'Fast, cost-efficient model for high-volume tasks'
  if (modelId.includes('gpt-4o')) return 'Flagship multimodal model with superior vision and reasoning'
  if (modelId.includes('o3') || modelId.includes('o1')) return 'Advanced reasoning model for complex problem-solving'
  if (modelId.includes('gpt-4-turbo')) return 'Powerful multimodal capabilities with large context'
  if (modelId.includes('gpt-4')) return 'Advanced reasoning and analysis'
  if (modelId.includes('gpt-3.5')) return 'Fast and cost-effective'
  return ''
}
