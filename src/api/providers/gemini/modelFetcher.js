import { REQUEST_TIMEOUT, formatContextWindow, formatGeminiName } from '@/core/model/ModelUtils'
import { getProviderById } from '@/config/providers'

/**
 * Fetch models from Google Gemini
 */
export async function fetchGeminiModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const provider = getProviderById('gemini')
  const baseUrl = provider.apiBaseUrl.replace(/\/$/, '')
  const endpoint = `${baseUrl}${provider.modelsEndpoint}?key=${apiKey}`

  try {
    const response = await fetch(
      endpoint,
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new Error('Invalid API key. Please check your Gemini API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please try again in a minute.')
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()

    return data.models
      .filter(model =>
        model.supportedGenerationMethods &&
        model.supportedGenerationMethods.includes('generateContent')
      )
      .map(model => ({
        id: model.name.replace('models/', ''),
        name: formatGeminiName(model.displayName || model.name),
        contextWindow: formatContextWindow(model.inputTokenLimit),
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
