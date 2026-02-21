export const config = {
  endpoint: (apiKey, customConfig) => {
    return `${customConfig.apiBaseUrl}${customConfig.modelsEndpoint}`
  },
  headers: (apiKey, customConfig) => {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (customConfig.authHeaderKey && customConfig.authHeaderValue) {
      const value = customConfig.authHeaderValue.replace('{key}', apiKey)
      headers[customConfig.authHeaderKey] = value
    }
    return headers
  },
  extractModelCount: (data) => {
    if (Array.isArray(data)) return data.length
    if (data.data && Array.isArray(data.data)) return data.data.length
    if (data.models && Array.isArray(data.models)) return data.models.length
    return 0
  }
}
