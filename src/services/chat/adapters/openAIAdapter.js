/**
 * OpenAI-compatible chat adapter
 * Handles: OpenAI, OpenRouter, and all custom OpenAI-compatible providers
 */

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
  modalities = null, // For image generation: ['image', 'text']
  reasoning = null // For thinking models: { effort: 'high' } or { max_tokens: 2000 }
}) {
  let fullContent = ''
  let fullReasoning = ''
  let reasoningDone = false
  let completeCalled = false

  try {
    const requestBody = {
      model,
      messages,
      stream: true,
      temperature: 0.7
    }

    // Add modalities for image generation if specified
    if (modalities && Array.isArray(modalities)) {
      requestBody.modalities = modalities
    }

    // Add reasoning for thinking models if specified
    if (reasoning) {
      requestBody.reasoning = reasoning
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
        console.log('Stream aborted - exiting read loop early')
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

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith(':')) continue

        // SSE format: "data: {json}"
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.substring(6) // Remove "data: " prefix

          // Check for end of stream
          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(data)

            // Extract content from delta
            const delta = parsed.choices?.[0]?.delta

            // Handle reasoning tokens (thinking)
            if (delta?.reasoning && onReasoningChunk) {
              fullReasoning += delta.reasoning
              onReasoningChunk(delta.reasoning, fullReasoning)
            }

            // When content starts, reasoning is complete
            if (delta?.content && fullReasoning && !reasoningDone && onReasoningComplete) {
              onReasoningComplete()
              reasoningDone = true
            }

            // Handle regular content
            if (delta?.content) {
              fullContent += delta.content
              onChunk(delta.content, fullContent)
            }

            // Check for image content in various formats
            // Some models return images as separate message parts
            if (delta?.tool_calls || delta?.function_call) {
              console.log('Tool/function call detected:', delta)
            }

            // Check for image_url type content (multimodal responses)
            if (Array.isArray(delta?.content)) {
              for (const part of delta.content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                  const imageMarkdown = `\n![Generated Image](${part.image_url.url})\n`
                  fullContent += imageMarkdown
                  onChunk(imageMarkdown, fullContent)
                }
              }
            }

            // Handle OpenRouter image generation response format
            // Images are returned in delta.images array
            if (delta?.images && Array.isArray(delta.images)) {
              // Removed console.log for performance during streaming
              for (const image of delta.images) {
                const imageUrl = image.image_url?.url || image.url
                if (imageUrl) {
                  // Use special marker for images - will be parsed separately from markdown
                  const imageMarker = `\n[GENERATED_IMAGE:${imageUrl}:END_IMAGE]\n`
                  fullContent += imageMarker
                  onChunk(imageMarker, fullContent)
                }
              }
            }

            // Also check for images in the main message (some models return here)
            const message = parsed.choices?.[0]?.message
            if (message?.images && Array.isArray(message.images)) {
              // Removed console.log for performance during streaming
              for (const image of message.images) {
                const imageUrl = image.image_url?.url || image.url
                if (imageUrl) {
                  // Use special marker for images - will be parsed separately from markdown
                  const imageMarker = `\n[GENERATED_IMAGE:${imageUrl}:END_IMAGE]\n`
                  fullContent += imageMarker
                  onChunk(imageMarker, fullContent)
                }
              }
            }

            // Removed non-content delta logging for performance

            // Check if stream is finished
            if (parsed.choices?.[0]?.finish_reason) {
              // Stream ended
              console.log('Stream finished, finish_reason:', parsed.choices[0].finish_reason)
              break
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', data, parseError)
          }
        }
      }

      // Check if stream was aborted after processing this chunk
      if (abortSignal?.aborted) {
        console.log('Stream aborted - exiting after chunk processing')
        break
      }
    }

    // If we accumulated reasoning but never marked it complete, do so now
    if (fullReasoning && !reasoningDone && onReasoningComplete) {
      onReasoningComplete()
    }

    // Call onComplete only once
    if (!completeCalled) {
      completeCalled = true
      onComplete(fullContent)
    }
  } catch (error) {
    // Check if it was aborted
    if (error.name === 'AbortError') {
      console.log('Stream aborted by user')
      console.log('Abort cleanup - fullReasoning length:', fullReasoning.length, 'reasoningDone:', reasoningDone)

      // Cleanup: save and mark reasoning complete if it exists but wasn't marked
      if (fullReasoning.length > 0 && !reasoningDone) {
        console.log('Saving reasoning on abort:', fullReasoning.substring(0, 100))
        // Save the accumulated reasoning first
        if (onReasoningChunk) {
          onReasoningChunk('', fullReasoning)
        }
        // Then mark it as complete
        if (onReasoningComplete) {
          onReasoningComplete()
        }
      }

      // Finalize the message with whatever content we have so far (only if not already called)
      if (!completeCalled) {
        completeCalled = true
        onComplete(fullContent)
      }

      return
    }

    // Handle network errors and other unexpected errors
    // Categorize the error for better user feedback
    let errorMessage = error.message

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error: Unable to connect to the API. Please check your internet connection.'
    } else if (error.name === 'SyntaxError') {
      errorMessage = 'Invalid response from API. Please try again.'
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
