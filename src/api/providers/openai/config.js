import { getProviderById } from '@/config/providers'

export const config = {
  endpoint: (apiKey) => {
    const provider = getProviderById('openai')
    return `${provider.apiBaseUrl}${provider.modelsEndpoint}`
  },
  headers: (apiKey) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }),
  extractModelCount: (data) => {
    if (Array.isArray(data)) return data.length
    if (data.data && Array.isArray(data.data)) return data.data.length
    return 0
  }
}
