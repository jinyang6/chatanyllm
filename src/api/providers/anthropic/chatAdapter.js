/**
 * Anthropic Claude API adapter
 * Handles Claude-specific API format and streaming
 */

import { validateChatParams, getErrorMessageFromResponse, handleNetworkError } from '@/core/chat/utils/chatUtils'
import { getProviderById } from '@/config/providers'

export async function sendStreamingMessage({
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
  temperature = 1.0,
  maxTokens = 8192,
  topP = null,
  topK = null
}) {
  let fullContent = ''
  let fullReasoning = ''
  let reasoningDone = false
  let completeCalled = false
  let currentBlockType = null // Track if we're in a thinking block

  try {
    // Validate required parameters
    validateChatParams({ apiKey, model, messages })

    // Use provided baseUrl or fall back to config
    const provider = getProviderById('anthropic')
    const apiBase = (baseUrl || provider.apiBaseUrl).replace(/\/$/, '')
    const endpoint = `${apiBase}${provider.chatEndpoint}`

    // Convert messages to Anthropic format
    // Extract system message if present (Anthropic requires it separately)
    let systemMessage = null
    const anthropicMessages = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    const requestBody = {
      model,
      max_tokens: maxTokens,
      messages: anthropicMessages,
      stream: true,
      temperature
    }

    // Add optional parameters
    if (topP !== null) requestBody.top_p = topP
    if (topK !== null) requestBody.top_k = topK

    // Add system message if present
    if (systemMessage) {
      requestBody.system = systemMessage
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [provider.authHeaderKey]: apiKey,
        ...provider.extraHeaders
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = getErrorMessageFromResponse(response, errorData, 'Anthropic API')

      // Call onError instead of throwing - prevents uncaught errors
      const error = new Error(errorMessage)
      onError(error)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      // Check if stream was aborted before reading next chunk
      if (abortSignal?.aborted) {
        break
      }

      const { done, value } = await reader.read()

      if (done) break

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim()

        // Skip empty lines and SSE comments
        if (!trimmedLine || trimmedLine.startsWith(':')) continue

        // SSE format can be "event: type" or "data: {json}"
        if (trimmedLine.startsWith('event: ')) {
          // Event type line, skip for now
          continue
        }

        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.substring(6) // Remove "data: " prefix

          try {
            const parsed = JSON.parse(data)

            // Handle different event types
            switch (parsed.type) {
              case 'message_start':
                // Message started
                break

              case 'content_block_start':
                // New content block starting
                currentBlockType = parsed.content_block?.type
                break

              case 'content_block_delta':
                // Content delta (streaming text or thinking)
                const delta = parsed.delta

                if (delta?.type === 'text_delta' && delta.text) {
                  // Check if this is a thinking block (currentBlockType === 'thinking')
                  if (currentBlockType === 'thinking' && onReasoningChunk) {
                    fullReasoning += delta.text
                    onReasoningChunk(delta.text, fullReasoning)
                  } else {
                    // Regular text content
                    // If we were in thinking mode and now getting regular content, mark thinking complete
                    if (fullReasoning && !reasoningDone && onReasoningComplete) {
                      onReasoningComplete()
                      reasoningDone = true
                    }
                    fullContent += delta.text
                    onChunk(delta.text, fullContent)
                  }
                }
                break

              case 'content_block_stop':
                // Content block finished
                // If it was a thinking block, mark reasoning as complete
                if (currentBlockType === 'thinking' && fullReasoning && !reasoningDone && onReasoningComplete) {
                  onReasoningComplete()
                  reasoningDone = true
                }
                currentBlockType = null
                break

              case 'message_delta':
                // Message metadata update (e.g., stop_reason)
                break

              case 'message_stop':
                // Stream ended
                break

              case 'ping':
                // Keep-alive ping, ignore
                break

              case 'error':
                // Error event
                const error = new Error(parsed.error?.message || 'Unknown error from Claude API')
                onError(error)
                return

              default:
                // Unknown event type, ignore
                break
            }
          } catch (parseError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Failed to parse SSE data:', parseError)
            }
          }
        }
      }

      // Check if stream was aborted after processing this chunk
      if (abortSignal?.aborted) {
        break
      }
    }

    // Finalize reasoning if it exists but wasn't marked complete
    if (fullReasoning && !reasoningDone && onReasoningComplete) {
      onReasoningComplete()
    }

    // Call onComplete callback once
    if (!completeCalled) {
      completeCalled = true
      onComplete(fullContent)
    }
  } catch (error) {
    // Handle abort signal
    if (error.name === 'AbortError') {
      // Save accumulated reasoning before finalizing
      if (fullReasoning.length > 0 && !reasoningDone) {
        if (onReasoningChunk) {
          onReasoningChunk('', fullReasoning)
        }
        if (onReasoningComplete) {
          onReasoningComplete()
        }
      }

      // Finalize with partial content
      if (!completeCalled) {
        completeCalled = true
        onComplete(fullContent)
      }

      return
    }

    // Handle network errors and other unexpected errors
    const errorMessage = handleNetworkError(error, 'Anthropic API')
    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendStreamingMessage
}
