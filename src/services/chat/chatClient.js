/**
 * Main chat client router
 * Detects provider type and routes to appropriate adapter
 */

import * as openAIAdapter from './adapters/openAIAdapter'
import * as geminiAdapter from './adapters/geminiAdapter'
import * as anthropicAdapter from './adapters/anthropicAdapter'
import { getProviderById } from '@/config/providers'

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
export async function sendStreamingMessage({
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
  if (!apiKey) {
    onError(new Error('API key is required'))
    return
  }

  if (!model) {
    onError(new Error('Model is required'))
    return
  }

  if (!messages || messages.length === 0) {
    onError(new Error('Messages are required'))
    return
  }

  // Determine which adapter to use based on provider
  try {
    // Handle built-in providers
    switch (providerId) {
      case 'openai':
        try {
          return await openAIAdapter.sendStreamingMessage({
            apiKey,
            baseUrl: 'https://api.openai.com/v1',
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
          // Safety net: Catch any unexpected errors from adapter
          console.error('Unexpected error from OpenAI adapter:', adapterError)
          throw adapterError
        }

      case 'openrouter':
        try {
          return await openAIAdapter.sendStreamingMessage({
            apiKey,
            baseUrl: 'https://openrouter.ai/api/v1',
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
          // Safety net: Catch any unexpected errors from adapter
          console.error('Unexpected error from OpenRouter adapter:', adapterError)
          throw adapterError
        }

      case 'gemini':
        try {
          return await geminiAdapter.sendStreamingMessage({
            apiKey,
            model,
            messages,
            onChunk,
            onComplete,
            onError,
            abortSignal
          })
        } catch (adapterError) {
          // Safety net: Catch any unexpected errors from adapter
          console.error('Unexpected error from Gemini adapter:', adapterError)
          throw adapterError
        }

      case 'anthropic':
        try {
          return await anthropicAdapter.sendStreamingMessage({
            apiKey,
            model,
            messages,
            onChunk,
            onReasoningChunk,
            onReasoningComplete,
            onComplete,
            onError,
            abortSignal
          })
        } catch (adapterError) {
          // Safety net: Catch any unexpected errors from adapter
          console.error('Unexpected error from Anthropic adapter:', adapterError)
          throw adapterError
        }

      default:
        // Handle custom providers (all are OpenAI-compatible)
        if (providerConfig && providerConfig.apiBaseUrl) {
          // Clean up base URL - remove trailing slashes and common path suffixes
          let baseUrl = providerConfig.apiBaseUrl.trim()

          // Remove trailing slashes
          baseUrl = baseUrl.replace(/\/+$/, '')

          // Remove /chat/completions if it was accidentally included
          baseUrl = baseUrl.replace(/\/chat\/completions$/, '')

          try {
            return await openAIAdapter.sendStreamingMessage({
              apiKey,
              baseUrl,
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
            // Safety net: Catch any unexpected errors from adapter
            console.error('Unexpected error from custom provider adapter:', adapterError)
            throw adapterError
          }
        } else {
          // Try to get provider config from built-in providers
          const provider = getProviderById(providerId)
          if (provider && provider.apiBaseUrl) {
            let baseUrl = provider.apiBaseUrl.trim()
            baseUrl = baseUrl.replace(/\/+$/, '')
            baseUrl = baseUrl.replace(/\/chat\/completions$/, '')

            try {
              return await openAIAdapter.sendStreamingMessage({
                apiKey,
                baseUrl,
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
              // Safety net: Catch any unexpected errors from adapter
              console.error('Unexpected error from provider adapter:', adapterError)
              throw adapterError
            }
          } else {
            // Call onError instead of throwing - prevents uncaught errors
            const error = new Error(`Unknown provider: ${providerId}. Please check your provider configuration.`)
            onError(error)
            return
          }
        }
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

/**
 * Test connection to a provider
 * @param {Object} params
 * @param {string} params.providerId - Provider ID
 * @param {Object} params.providerConfig - Custom provider configuration
 * @param {string} params.apiKey - API key
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testConnection({ providerId, providerConfig = null, apiKey }) {
  return new Promise((resolve) => {
    const abortController = new AbortController()

    // Set timeout for test
    const timeout = setTimeout(() => {
      abortController.abort()
      resolve({ success: false, error: 'Connection test timed out' })
    }, 10000) // 10 second timeout

    sendStreamingMessage({
      providerId,
      providerConfig,
      apiKey,
      model: 'gpt-3.5-turbo', // Use a simple model for testing
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: () => {
        // Got a chunk, connection works
        clearTimeout(timeout)
        abortController.abort() // Stop the test
        resolve({ success: true })
      },
      onComplete: () => {
        clearTimeout(timeout)
        resolve({ success: true })
      },
      onError: (error) => {
        clearTimeout(timeout)
        resolve({ success: false, error: error.message })
      },
      abortSignal: abortController.signal
    })
  })
}

export default {
  sendStreamingMessage,
  testConnection
}
