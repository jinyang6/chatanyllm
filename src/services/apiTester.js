/**
 * API Connection Testing Service
 * Tests API keys and endpoints for various providers
 */

const REQUEST_TIMEOUT = 10000 // 10 seconds

/**
 * Test API connection for a provider
 * @param {string} providerId - Provider ID
 * @param {string} apiKey - API key to test
 * @param {object|null} customConfig - Custom provider configuration
 * @returns {Promise<object>} Test result
 */
export async function testApiConnection(providerId, apiKey, customConfig = null) {
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      statusCode: null,
      title: 'No API Key',
      message: 'Please enter an API key to test.',
      details: 'API key field is empty.',
      modelCount: 0,
      error: 'MISSING_API_KEY'
    }
  }

  try {
    // Determine endpoint based on provider
    let endpoint, headers

    if (customConfig) {
      // Custom provider
      endpoint = `${customConfig.apiBaseUrl}${customConfig.modelsEndpoint}`
      headers = buildHeaders(customConfig.authHeaderKey, customConfig.authHeaderValue, apiKey)
    } else {
      // Built-in provider
      const config = getProviderConfig(providerId)
      endpoint = typeof config.endpoint === 'function' ? config.endpoint(apiKey) : config.endpoint
      headers = config.headers(apiKey)
    }

    // Test the connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Handle different response codes
      return handleResponse(response, providerId)

    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          statusCode: null,
          title: 'Connection Timeout',
          message: 'Could not connect to the API server.',
          details: `Request timeout after ${REQUEST_TIMEOUT / 1000} seconds. Check your internet connection.`,
          modelCount: 0,
          error: 'TIMEOUT'
        }
      }

      // Network error
      return {
        success: false,
        statusCode: null,
        title: 'Network Error',
        message: 'Failed to reach the API server.',
        details: `Network error: ${fetchError.message}. Check your internet connection and firewall settings.`,
        modelCount: 0,
        error: 'NETWORK_ERROR'
      }
    }

  } catch (error) {
    return {
      success: false,
      statusCode: null,
      title: 'Test Failed',
      message: 'An unexpected error occurred while testing.',
      details: error.message,
      modelCount: 0,
      error: 'UNKNOWN_ERROR'
    }
  }
}

/**
 * Handle API response and extract results
 */
async function handleResponse(response, providerId) {
  const statusCode = response.status

  // Success - 200 OK
  if (statusCode === 200) {
    try {
      const data = await response.json()
      const modelCount = extractModelCount(data, providerId)

      // OpenRouter auth endpoint provides key info instead of model list
      const details = providerId === 'openrouter'
        ? 'API key validated successfully.'
        : `Found ${modelCount} models available.`

      return {
        success: true,
        statusCode: 200,
        title: 'Connection Successful',
        message: 'Your API key is valid and working correctly.',
        details,
        modelCount,
        error: null
      }
    } catch (parseError) {
      return {
        success: false,
        statusCode: 200,
        title: 'Invalid Response',
        message: 'API returned invalid data format.',
        details: `Could not parse response: ${parseError.message}`,
        modelCount: 0,
        error: 'PARSE_ERROR'
      }
    }
  }

  // Unauthorized - 401
  if (statusCode === 401) {
    return {
      success: false,
      statusCode: 401,
      title: 'Invalid API Key',
      message: 'The API key you provided is not authorized.',
      details: 'Error 401: Unauthorized. Please check your API key is correct and has not expired.',
      modelCount: 0,
      error: 'UNAUTHORIZED'
    }
  }

  // Forbidden - 403
  if (statusCode === 403) {
    return {
      success: false,
      statusCode: 403,
      title: 'Access Forbidden',
      message: "Your API key doesn't have permission to access this endpoint.",
      details: 'Error 403: Forbidden. Check your API key permissions and subscription status.',
      modelCount: 0,
      error: 'FORBIDDEN'
    }
  }

  // Not Found - 404
  if (statusCode === 404) {
    return {
      success: false,
      statusCode: 404,
      title: 'Endpoint Not Found',
      message: 'The API endpoint could not be found.',
      details: 'Error 404: Not Found. Check your API base URL and endpoint path are correct.',
      modelCount: 0,
      error: 'NOT_FOUND'
    }
  }

  // Rate Limited - 429
  if (statusCode === 429) {
    return {
      success: false,
      statusCode: 429,
      title: 'Rate Limited',
      message: 'Too many requests. Please wait before testing again.',
      details: 'Error 429: Rate limit exceeded. Try again in a few minutes.',
      modelCount: 0,
      error: 'RATE_LIMITED'
    }
  }

  // Server Error - 500+
  if (statusCode >= 500) {
    return {
      success: false,
      statusCode,
      title: 'Server Error',
      message: 'The API server encountered an error.',
      details: `Error ${statusCode}: The provider's server is experiencing issues. Try again later.`,
      modelCount: 0,
      error: 'SERVER_ERROR'
    }
  }

  // Other errors
  return {
    success: false,
    statusCode,
    title: 'Connection Failed',
    message: `Unexpected response code: ${statusCode}`,
    details: `The API returned an unexpected status code. Please check your configuration.`,
    modelCount: 0,
    error: 'UNKNOWN_STATUS'
  }
}

/**
 * Extract model count from API response
 */
function extractModelCount(data, providerId) {
  // OpenRouter auth endpoint returns key info, not models
  if (providerId === 'openrouter' && data.data) {
    // Auth endpoint response - key is valid but doesn't contain model count
    // Return 1 to indicate successful validation
    return 1
  }

  // Different providers return data in different formats
  if (Array.isArray(data)) {
    return data.length
  }

  if (data.data && Array.isArray(data.data)) {
    return data.data.length
  }

  if (data.models && Array.isArray(data.models)) {
    return data.models.length
  }

  // Gemini specific
  if (providerId === 'gemini' && data.models) {
    return data.models.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    ).length
  }

  return 0
}

/**
 * Get provider configuration for testing
 */
function getProviderConfig(providerId) {
  const configs = {
    openrouter: {
      endpoint: 'https://openrouter.ai/api/v1/auth/key',
      headers: (apiKey) => ({
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'ChatAnyLLM'
      })
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/models',
      headers: (apiKey) => ({
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      })
    },
    gemini: {
      endpoint: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      headers: () => ({})
    }
  }

  return configs[providerId] || {
    endpoint: null,
    headers: () => ({})
  }
}

/**
 * Build headers from custom provider config
 */
function buildHeaders(headerKey, headerValue, apiKey) {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (headerKey && headerValue) {
    const value = headerValue.replace('{key}', apiKey)
    headers[headerKey] = value
  }

  return headers
}

/**
 * Quick validation before testing (synchronous check)
 */
export function validateBeforeTest(providerId, apiKey, customConfig = null) {
  const errors = []

  if (!apiKey || !apiKey.trim()) {
    errors.push('API key is required')
  }

  if (customConfig) {
    if (!customConfig.apiBaseUrl) {
      errors.push('API base URL is required')
    }
    if (!customConfig.modelsEndpoint) {
      errors.push('Models endpoint is required')
    }
    if (!customConfig.authHeaderKey || !customConfig.authHeaderValue) {
      errors.push('Authentication header configuration is required')
    }
    if (customConfig.authHeaderValue && !customConfig.authHeaderValue.includes('{key}')) {
      errors.push('Auth header value must include {key} placeholder')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
