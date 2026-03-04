export const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified gateway providing access to open-source and proprietary models.',
    badge: 'Recommended',
    badgeVariant: 'default',
    apiKeyUrl: 'https://openrouter.ai/keys',
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    testEndpoint: '/auth/key',
    authHeaderKey: 'Authorization',
    authHeaderValue: 'Bearer {key}',
    extraHeaders: {
      'X-Title': 'ChatAnyLLM'
    },
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'anthropic/claude-3.7-sonnet',
        name: 'Claude 3.7 Sonnet',
        contextWindow: '200k',
        description: 'Hybrid reasoning model featuring both standard and extended thought modes.'
      },
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        contextWindow: '128k',
        description: 'High-performance multimodal model for fast and complex instruction following.'
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Advanced models for multimodal analysis and general-purpose intelligence.',
    badge: null,
    badgeVariant: null,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiBaseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    authHeaderKey: 'Authorization',
    authHeaderValue: 'Bearer {key}',
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'o1',
        name: 'o1',
        contextWindow: '128k',
        description: 'Advanced reasoning model for complex scientific and mathematical logic.'
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        contextWindow: '128k',
        description: 'Efficient reasoning model providing deep logic with lower latency.'
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: '128k',
        description: 'Flagship model balancing intelligence across text and vision.'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: '128k',
        description: 'Fast, cost-efficient model for high-volume, high-speed tasks.'
      }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Multimodal models with large context windows for data processing and analysis.',
    badge: null,
    badgeVariant: null,
    apiKeyUrl: 'https://makersuite.google.com/app/apikey',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: '/models',
    chatEndpoint: '/:model:streamGenerateContent',
    authHeaderKey: null,
    authHeaderValue: null,
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: '1M',
        description: 'Next-generation model optimized for low-latency multimodal processing.'
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: '2M',
        description: 'High-capacity model for analyzing massive datasets and long documents.'
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: '1M',
        description: 'Fast, lightweight model designed for speed and efficient scaling.'
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Models for high-fidelity code generation and instruction following for tool use.',
    badge: null,
    badgeVariant: null,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiBaseUrl: 'https://api.anthropic.com',
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/messages',
    authHeaderKey: 'x-api-key',
    authHeaderValue: '{key}',
    extraHeaders: {
      'anthropic-version': '2023-06-01'
    },
    supportsDynamicFetch: true,
    requiresApiKey: true,
    fallbackModels: [
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        contextWindow: '200k',
        description: 'State-of-the-art model with a hybrid reasoning engine and reliable tool-calling.'
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        contextWindow: '200k',
        description: 'Balanced model for high intelligence and precise technical tasks.'
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: '200k',
        description: 'High-speed model for automated workflows and rapid code generation.'
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
