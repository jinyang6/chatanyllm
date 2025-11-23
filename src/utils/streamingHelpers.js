/**
 * Utility functions for streaming message configuration
 */

import { getModalitiesForModel, getReasoningConfig } from './modelHelpers'

/**
 * Create streaming callbacks configuration
 * @param {Object} config - Configuration object
 * @param {string} config.conversationId - ID of the conversation
 * @param {Function} config.updateLastMessage - Function to update last message
 * @param {Function} config.updateLastMessageReasoning - Function to update reasoning
 * @param {Function} config.markReasoningComplete - Function to mark reasoning complete
 * @param {Function} config.getConversationById - Function to get conversation by ID
 * @param {Function} config.stopStreaming - Function to stop streaming
 * @param {Function} config.onError - Error callback
 * @param {Object} config.metadata - Additional metadata to preserve
 * @returns {Object} Streaming callbacks configuration
 */
export function createStreamingCallbacks({
  conversationId,
  updateLastMessage,
  updateLastMessageReasoning,
  markReasoningComplete,
  getConversationById,
  stopStreaming,
  onError,
  metadata = null
}) {
  return {
    onChunk: (chunk, fullContent) => {
      updateLastMessage(fullContent, false, null, conversationId)
    },

    onReasoningChunk: (reasoningChunk, fullReasoning) => {
      updateLastMessageReasoning(fullReasoning, false, conversationId)
    },

    onReasoningComplete: () => {
      markReasoningComplete(conversationId)
    },

    onComplete: (fullContent) => {
      // Preserve reasoning state in metadata
      const targetConversation = getConversationById(conversationId)
      const lastMessage = targetConversation?.messages?.[targetConversation.messages.length - 1]

      // Only include reasoning properties if reasoning exists (prevents creating reasoning: undefined)
      const finalMetadata = lastMessage ? {
        ...(metadata || {}),
        ...(lastMessage.reasoning ? {
          reasoning: lastMessage.reasoning,
          isReasoningComplete: lastMessage.isReasoningComplete || true
        } : {})
      } : metadata

      updateLastMessage(fullContent, true, finalMetadata, conversationId)
      stopStreaming(conversationId)
    },

    onError: (error) => {
      console.error('Streaming error:', error)
      updateLastMessage(`Error: ${error.message}`, false, null, conversationId)
      stopStreaming(conversationId)

      if (onError) {
        onError(error)
      }
    }
  }
}

/**
 * Build complete streaming message configuration
 * @param {Object} config - Configuration object
 * @param {string} config.provider - Provider ID
 * @param {string} config.apiKey - API key for the provider
 * @param {string} config.model - Model ID
 * @param {Array} config.messages - Messages to send
 * @param {Array} config.customProviders - Custom provider configurations
 * @param {AbortSignal} config.abortSignal - Abort signal for cancellation
 * @param {Array} config.availableModels - Available models list
 * @param {Object} config.callbacks - Streaming callbacks
 * @returns {Object} Complete streaming configuration
 */
export function buildStreamingConfig({
  provider,
  apiKey,
  model,
  messages,
  customProviders,
  abortSignal,
  availableModels,
  callbacks
}) {
  return {
    providerId: provider,
    providerConfig: customProviders.find(p => p.id === provider),
    apiKey,
    model,
    messages,
    abortSignal,
    modalities: getModalitiesForModel(model, availableModels),
    reasoning: getReasoningConfig(model),
    ...callbacks
  }
}
