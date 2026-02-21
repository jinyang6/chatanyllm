import { REQUEST_TIMEOUT, formatContextWindow } from '@/core/model/ModelUtils'
import { getProviderById } from '@/config/providers'

/**
 * Fetch models from OpenRouter
 */
export async function fetchOpenRouterModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const provider = getProviderById('openrouter')
  const baseUrl = provider.apiBaseUrl.replace(/\/$/, '')
  const endpoint = `${baseUrl}${provider.modelsEndpoint}`

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...provider.extraHeaders,
        'HTTP-Referer': window.location.origin
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.')
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Please try again in a minute.')
      }
      throw new Error(`Failed to fetch models: ${response.statusText}`)
    }

    const data = await response.json()

    // Log first few models to see API structure (only in development)
    if (data.data.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('📋 OpenRouter API - Sample model data:', {
        sampleModel: data.data[0],
        architecture: data.data[0].architecture,
        supportedParameters: data.data[0].supported_parameters
      })
    }

    return data.data.map(model => {
      // Extract reasoning capabilities from OpenRouter API fields
      const architecture = model.architecture || {}
      const supportedParams = model.supported_parameters || []
      const pricing = model.pricing || {}

      // A model supports reasoning if:
      // 1. It has 'reasoning' in supported_parameters
      // 2. OR it has non-zero internal_reasoning pricing (means it can produce reasoning tokens)
      const hasReasoningParam = supportedParams.includes('reasoning')
      const hasReasoningPricing = pricing.internal_reasoning &&
                                  parseFloat(pricing.internal_reasoning) !== 0

      const supportsReasoning = hasReasoningParam || hasReasoningPricing

      return {
        id: model.id,
        name: model.name || model.id,
        contextWindow: formatContextWindow(model.context_length),
        description: model.description || '',
        pricing: {
          input: parseFloat(pricing.prompt || 0),
          output: parseFloat(pricing.completion || 0),
          internalReasoning: parseFloat(pricing.internal_reasoning || 0)
        },
        // Include modality information for UI display
        inputModalities: architecture.input_modalities || ['text'],
        outputModalities: architecture.output_modalities || ['text'],
        // Reasoning capability detected from official API fields
        supportsReasoning,
        // Store detection details for debugging
        reasoningDetection: {
          hasReasoningParam,
          hasReasoningPricing,
          supportedParams
        }
      }
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection.')
    }
    throw error
  }
}
