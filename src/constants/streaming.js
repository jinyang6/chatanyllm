/**
 * Constants for streaming and message handling
 */

/**
 * Streaming-related constants
 */
export const STREAMING_CONSTANTS = {
  // Reasoning effort level for thinking models
  REASONING_EFFORT: 'high',

  // UI update throttle interval in milliseconds
  UI_UPDATE_THROTTLE_MS: 100,

  // Save debounce delay in milliseconds
  SAVE_DEBOUNCE_MS: 2000,

  // Abort controller cleanup delay in milliseconds
  ABORT_CLEANUP_DELAY_MS: 100
}

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  RATE_LIMIT: 'Rate limit exceeded. Please wait a moment and try again.',
  MISSING_API_KEY: 'API key not configured',
  INVALID_API_KEY: 'Invalid API key',
  NETWORK_ERROR: 'Network error occurred'
}
