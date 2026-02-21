import { getProviderById } from '@/config/providers'

export const config = {
  endpoint: (apiKey) => {
    const provider = getProviderById('gemini')
    return `${provider.apiBaseUrl}${provider.modelsEndpoint}?key=${apiKey}`
  },
  headers: (apiKey) => ({}),
  extractModelCount: (data) => {
    if (data.models && Array.isArray(data.models)) {
      return data.models.filter(m =>
        m.supportedGenerationMethods?.includes('generateContent')
      ).length
    }
    return 0
  }
}
