/**
 * Main chat client router
 * Detects provider type and routes to appropriate adapter
 */

import { adapters } from '@/api/providers'
import { getProviderById } from '@/config/providers'
import { validateChatParams, sanitizeBaseUrl } from './utils/chatUtils'
import { testConnection } from './connectionTester'

/**
 * Send a streaming chat message
 * @param {Object} params
 * @param {string} params.providerId - Provider ID (openai, anthropic, gemini, openrouter, or custom)
 * @param {Object} params.providerConfig - Custom provider configuration (for custom providers)
 * @param {string} params.apiKey - API key for the provider
 * @param {string} params.model - Model ID
 * @param {Array} params.messages - Array of message objects [{ role: 'user'|'assistant'|'system', content: 'text' }]
 * @param {Function} params.onChunk - Callback for each content chunk (chunk, fullContent)
 * @param {Function} params.onComplete - Callback when streaming completes (fullContent)
 * @param {Function} params.onError - Callback for errors (error)
 * @param {AbortSignal} params.abortSignal - Signal to abort the request
 */
export async function sendMessage({
  providerId,
  providerConfig = null,
  apiKey,
  model,
  messages,
  onChunk,
  onReasoningChunk,
  onReasoningComplete,
  onComplete,
  onError,
  abortSignal,
  modalities = null, // For image generation: ['image', 'text']
  reasoning = null // For thinking models: { effort: 'high' }
}) {
  // Validate inputs
  try {
    validateChatParams({ apiKey, model, messages })
  } catch (error) {
    onError(error)
    return
  }

  // Determine which adapter to use based on provider
  try {
    const provider = getProviderById(providerId)
    const baseUrl = provider?.apiBaseUrl ? sanitizeBaseUrl(provider.apiBaseUrl) : null

    // Choose adapter
    const adapter = adapters[providerId] || (providerConfig ? adapters.custom : null)

    if (adapter) {
      // Determine base URL
      let effectiveBaseUrl = baseUrl
      if (providerId === 'openai' && !baseUrl) effectiveBaseUrl = 'https://api.openai.com/v1'
      if (providerId === 'openrouter' && !baseUrl) effectiveBaseUrl = 'https://openrouter.ai/api/v1'
      if (providerConfig && providerConfig.apiBaseUrl) effectiveBaseUrl = sanitizeBaseUrl(providerConfig.apiBaseUrl)

      try {
        return await adapter.sendStreamingMessage({
          apiKey,
          baseUrl: effectiveBaseUrl,
          model,
          messages,
          onChunk,
          onReasoningChunk,
          onReasoningComplete,
          onComplete,
          onError,
          abortSignal,
          modalities,
          reasoning
        })
      } catch (adapterError) {
        console.error(`Unexpected error from ${providerId} adapter:`, adapterError)
        throw adapterError
      }
    } else {
      const error = new Error(`Unknown provider: ${providerId}. Please check your provider configuration.`)
      onError(error)
      return
    }
  } catch (error) {
    // Final safety net: Catch any uncaught errors and pass to onError callback
    console.error('Chat client error:', error)

    // Categorize the error for better user feedback
    let errorMessage = error.message

    if (error.name === 'TypeError') {
      errorMessage = `Configuration error: ${error.message}. Please check your provider settings.`
    } else if (!errorMessage) {
      errorMessage = 'An unexpected error occurred while sending the message. Please try again.'
    }

    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendMessage,
  testConnection
}
