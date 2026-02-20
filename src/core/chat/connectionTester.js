/**
 * Connection tester for chat providers
 */

import { sendMessage } from './ChatManager'

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

    sendMessage({
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
  testConnection
}
