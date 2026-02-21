import { getProviderById } from '@/config/providers'

export const config = {
  endpoint: (apiKey) => {
    const provider = getProviderById('anthropic')
    return `${provider.apiBaseUrl}${provider.modelsEndpoint}`
  },
  headers: (apiKey) => {
    const provider = getProviderById('anthropic')
    return {
      [provider.authHeaderKey]: apiKey,
      ...provider.extraHeaders
    }
  },
  extractModelCount: (data) => {
    if (Array.isArray(data)) return data.length
    if (data.data && Array.isArray(data.data)) return data.data.length
    if (data.models && Array.isArray(data.models)) return data.models.length
    return 0
  }
}
