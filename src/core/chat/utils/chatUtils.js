/**
 * Shared chat utility functions
 */

/**
 * Common validation for chat parameters
 * @param {Object} params
 * @throws {Error} if validation fails
 */
export function validateChatParams({ apiKey, model, messages }) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key is required')
  }
  if (!model || typeof model !== 'string') {
    throw new Error('Model is required')
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages are required and must be a non-empty array')
  }
}

/**
 * Consistent cleanup of API base URLs
 * @param {string} url
 * @returns {string} Sanitized URL
 */
export function sanitizeBaseUrl(url) {
  if (!url) return ''
  let sanitized = url.trim()
  // Remove trailing slashes
  sanitized = sanitized.replace(/\/+$/, '')
  // Remove /chat/completions if it was accidentally included
  sanitized = sanitized.replace(/\/chat\/completions$/, '')
  return sanitized
}

/**
 * Generic mapping of HTTP status codes to user-friendly error messages
 * @param {Response} response - Fetch response object
 * @param {Object} errorData - Parsed JSON error data
 * @param {string} providerName - Name of the provider for context
 * @returns {string} User-friendly error message
 */
export function getErrorMessageFromResponse(response, errorData, providerName = 'API') {
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    const waitTime = retryAfter ? ` Please wait ${retryAfter} seconds.` : ''
    return `Rate limit exceeded.${waitTime}`
  }

  if (response.status === 401) {
    return errorData.error?.message || `Invalid API key or unauthorized access to ${providerName}.`
  }

  if (response.status === 403) {
    return errorData.error?.message || `Access forbidden. Check your ${providerName} API key permissions.`
  }

  if (response.status === 404) {
    return errorData.error?.message || 'Model or endpoint not found.'
  }

  if (response.status >= 500) {
    return errorData.error?.message || `Server error (${response.status}) from ${providerName}. Please try again later.`
  }

  return errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
}

/**
 * Consistent handling of fetch-related errors
 * @param {Error} error - The caught error
 * @param {string} providerName - Name of the provider for context
 * @returns {string} User-friendly error message
 */
export function handleNetworkError(error, providerName = 'API') {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return `Network error: Unable to connect to ${providerName}. Please check your internet connection.`
  }

  if (error.name === 'SyntaxError') {
    return `Invalid response from ${providerName}. Please try again.`
  }

  return error.message || 'An unexpected error occurred. Please try again.'
}

export default {
  validateChatParams,
  sanitizeBaseUrl,
  getErrorMessageFromResponse,
  handleNetworkError
}
