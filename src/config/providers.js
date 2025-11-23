export const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API gateway providing access to multiple frontier AI models',
    badge: 'Recommended',
    badgeVariant: 'default',
    apiKeyUrl: 'https://openrouter.ai/keys',
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    authHeaderKey: 'Authorization',
    authHeaderValue: 'Bearer {key}',
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        contextWindow: '200k',
        description: 'Most intelligent model, best for complex tasks'
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: '128k',
        description: 'Fast and capable, great for general use'
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Versatile models for text generation, reasoning, and visual understanding',
    badge: null,
    badgeVariant: null,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiBaseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    authHeaderKey: 'Authorization',
    authHeaderValue: 'Bearer {key}',
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: '128k',
        description: 'Flagship multimodal model with superior vision and reasoning'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: '128k',
        description: 'Fast, cost-efficient model for high-volume tasks'
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        contextWindow: '128k',
        description: 'Advanced reasoning model for complex problem-solving'
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: '128k',
        description: 'Powerful multimodal capabilities with large context'
      }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Advanced models excelling at coding, search, and large-scale analysis',
    badge: null,
    badgeVariant: null,
    apiKeyUrl: 'https://makersuite.google.com/app/apikey',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    authHeaderKey: null, // Uses query param instead
    authHeaderValue: null,
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        contextWindow: '1M',
        description: 'State-of-the-art reasoning for complex code and STEM tasks'
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: '1M',
        description: 'Best price-performance for large-scale, low-latency workloads'
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        contextWindow: '1M',
        description: 'Fastest model optimized for cost-efficiency and high throughput'
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: '1M',
        description: 'Production-ready multimodal model with strong performance'
      }
    ]
  }
]

export function getProviderById(providerId) {
  return PROVIDERS.find(p => p.id === providerId)
}

export function getModelById(providerId, modelId) {
  const provider = getProviderById(providerId)
  if (!provider) return null

  // Check static models first
  if (provider.models) {
    return provider.models.find(m => m.id === modelId)
  }

  // Check fallback models
  if (provider.fallbackModels) {
    return provider.fallbackModels.find(m => m.id === modelId)
  }

  return null
}

export function getAllModels(providerId) {
  const provider = getProviderById(providerId)
  if (!provider) return []

  // Return static models if available
  if (provider.models) {
    return provider.models
  }

  // Return fallback models
  return provider.fallbackModels || []
}

export function getFallbackModels(providerId) {
  const provider = getProviderById(providerId)
  if (!provider) return []

  if (provider.models) return provider.models
  return provider.fallbackModels || []
}
