/**
 * Anthropic Claude API adapter
 * Handles Claude-specific API format and streaming
 */

export async function sendStreamingMessage({
  apiKey,
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
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key')
    }
    if (!model || typeof model !== 'string') {
      throw new Error('Invalid model')
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array')
    }

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      // Create appropriate error message based on status
      let errorMessage
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        const waitTime = retryAfter ? ` Please wait ${retryAfter} seconds.` : ''
        errorMessage = `Rate limit exceeded.${waitTime}`
      } else if (response.status === 401) {
        errorMessage = errorData.error?.message || 'Invalid API key or unauthorized access.'
      } else if (response.status === 403) {
        errorMessage = errorData.error?.message || 'Access forbidden. Check your API key permissions.'
      } else if (response.status === 404) {
        errorMessage = errorData.error?.message || 'Model or endpoint not found.'
      } else if (response.status >= 500) {
        errorMessage = errorData.error?.message || `Server error (${response.status}). Please try again later.`
      } else {
        errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      }

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
    let errorMessage = error.message

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error: Unable to connect to the Anthropic API. Please check your internet connection.'
    } else if (error.name === 'SyntaxError') {
      errorMessage = 'Invalid response from Anthropic API. Please try again.'
    } else if (!errorMessage) {
      errorMessage = 'An unexpected error occurred. Please try again.'
    }

    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendStreamingMessage
}
