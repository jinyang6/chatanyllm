import { getProviderById } from '@/config/providers'

export const config = {
  endpoint: (apiKey) => {
    const provider = getProviderById('openrouter')
    return `${provider.apiBaseUrl}${provider.testEndpoint}`
  },
  headers: (apiKey) => {
    const provider = getProviderById('openrouter')
    return {
      'Authorization': `Bearer ${apiKey}`,
      ...provider.extraHeaders,
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : ''
    }
  },
  extractModelCount: (data) => {
    // OpenRouter auth endpoint returns key info, not models
    if (data.data) return 1
    return 0
  }
}
