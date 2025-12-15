// Model fetcher service for different providers

const REQUEST_TIMEOUT = 10000 // 10 seconds

/**
 * Fetch models from OpenRouter
 */
async function fetchOpenRouterModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'ChatAnyLLM'
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

/**
 * Fetch models from OpenAI
 */
async function fetchOpenAIModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
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

/**
 * Fetch models from Google Gemini
 */
async function fetchGeminiModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
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

/**
 * Fetch models from Anthropic Claude
 */
async function fetchAnthropicModels(apiKey) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
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

/**
 * Fetch models from custom provider
 */
async function fetchCustomProviderModels(providerConfig, apiKey) {
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

/**
 * Main fetch function - routes to appropriate provider fetcher
 */
export async function fetchModelsForProvider(providerId, apiKey, customProviderConfig = null) {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  switch (providerId) {
    case 'openrouter':
      return await fetchOpenRouterModels(apiKey)

    case 'openai':
      return await fetchOpenAIModels(apiKey)

    case 'gemini':
      return await fetchGeminiModels(apiKey)

    case 'anthropic':
      return await fetchAnthropicModels(apiKey)

    default:
      // Custom provider
      if (customProviderConfig) {
        return await fetchCustomProviderModels(customProviderConfig, apiKey)
      }
      throw new Error(`Unknown provider: ${providerId}`)
  }
}

/**
 * Helper functions
 */

function formatContextWindow(tokens) {
  if (!tokens) return 'Unknown'
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`
  return `${tokens}`
}

function formatModelName(modelId) {
  // Convert model ID to readable name
  return modelId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatGeminiName(name) {
  if (!name) return 'Unknown'
  return name.replace('models/', '').replace(/-/g, ' ')
}

function formatAnthropicName(name) {
  if (!name) return 'Unknown'
  // Convert "claude-3-5-sonnet-20241022" to "Claude 3.5 Sonnet"
  const parts = name.split('-')
  if (parts[0] === 'claude') {
    // Extract version and model name
    const versionParts = []
    const nameParts = []
    let foundVersion = false

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      // Check if it's a number or date
      if (!isNaN(part) && part.length <= 2 && !foundVersion) {
        versionParts.push(part)
      } else if (part.length === 8 && !isNaN(part)) {
        // Date part, skip
        break
      } else {
        foundVersion = true
        nameParts.push(part.charAt(0).toUpperCase() + part.slice(1))
      }
    }

    if (versionParts.length > 0 && nameParts.length > 0) {
      return `Claude ${versionParts.join('.')} ${nameParts.join(' ')}`
    }
  }
  // Fallback
  return name.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getOpenAIContextWindow(modelId) {
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

function getOpenAIDescription(modelId) {
  if (modelId.includes('gpt-4o-mini')) return 'Fast, cost-efficient model for high-volume tasks'
  if (modelId.includes('gpt-4o')) return 'Flagship multimodal model with superior vision and reasoning'
  if (modelId.includes('o3') || modelId.includes('o1')) return 'Advanced reasoning model for complex problem-solving'
  if (modelId.includes('gpt-4-turbo')) return 'Powerful multimodal capabilities with large context'
  if (modelId.includes('gpt-4')) return 'Advanced reasoning and analysis'
  if (modelId.includes('gpt-3.5')) return 'Fast and cost-effective'
  return ''
}
