/**
 * Utility functions for error detection and handling
 */

/**
 * Error type enumeration
 */
export const ErrorType = {
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',
  NETWORK: 'NETWORK',
  OTHER: 'OTHER'
}

/**
 * Detect error type from error message
 * @param {Error} error - The error object
 * @returns {string} Error type from ErrorType enum
 */
export function detectErrorType(error) {
  const message = error.message || String(error)

  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return ErrorType.RATE_LIMIT
  }

  if (message.includes('401') || message.toLowerCase().includes('invalid api key')) {
    return ErrorType.INVALID_API_KEY
  }

  if (message.toLowerCase().includes('api key not configured')) {
    return ErrorType.MISSING_API_KEY
  }

  return ErrorType.OTHER
}

/**
 * Handle streaming errors with appropriate alerts
 * @param {Object} config - Configuration object
 * @param {Error} config.error - The error that occurred
 * @param {string} config.providerName - Name of the provider
 * @param {Object} config.errorHandlers - Error handler functions
 * @param {Function} config.onOpenSettings - Callback to open settings
 */
export function handleStreamingError({
  error,
  providerName,
  errorHandlers,
  onOpenSettings
}) {
  const errorType = detectErrorType(error)

  switch (errorType) {
    case ErrorType.RATE_LIMIT:
      errorHandlers.showFetchErrorAlert(
        providerName,
        'Rate limit exceeded. Please wait a moment and try again.'
      )
      break

    case ErrorType.INVALID_API_KEY:
      errorHandlers.showInvalidApiKeyAlert(
        providerName,
        error.message,
        () => {
          if (onOpenSettings) onOpenSettings()
        }
      )
      break

    case ErrorType.MISSING_API_KEY:
      errorHandlers.showMissingApiKeyAlert(
        providerName,
        () => {
          if (onOpenSettings) onOpenSettings()
        }
      )
      break

    default:
      errorHandlers.showFetchErrorAlert(providerName, error.message)
  }
}
