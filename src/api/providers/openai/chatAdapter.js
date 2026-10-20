/**
 * OpenAI-compatible chat adapter
 * Handles: OpenAI, OpenRouter, and all custom OpenAI-compatible providers
 * Updated: 2025-01-15
 */

import { validateChatParams, getErrorMessageFromResponse, handleNetworkError, normalizeOpenAIUsage } from '@/core/chat/utils/chatUtils'
import { getProviderById, DELTA_KEYS } from '@/config/providers'

/**
 * Return the first key from `keys` that exists on the delta object.
 */
function getDeltaValue(delta, keys) {
  if (!delta) return undefined
  for (const key of keys) {
    if (delta[key] !== undefined && delta[key] !== null) return delta[key]
  }
  return undefined
}

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
  reasoning = null, // For thinking models: { effort: 'high' } or { max_tokens: 2000 }
  temperature = 0.7,
  maxTokens = null,
  topP = null,
  frequencyPenalty = null,
  presencePenalty = null
}) {
  let fullContent = ''
  let fullReasoning = ''
  let reasoningDone = false
  let completeCalled = false
  let usage = null

  try {
    // Validate required parameters
    validateChatParams({ apiKey, model, messages })

    const requestBody = {
      model,
      messages,
      stream: true,
      temperature
    }

    // Add optional parameters only if specified
    if (maxTokens) requestBody.max_tokens = maxTokens
    if (topP !== null) requestBody.top_p = topP
    if (frequencyPenalty !== null) requestBody.frequency_penalty = frequencyPenalty
    if (presencePenalty !== null) requestBody.presence_penalty = presencePenalty

    // OpenAI only returns usage while streaming when explicitly requested.
    // Other OpenAI-compatible providers return it by default, and some strict
    // gateways reject unknown stream_options, so scope this to OpenAI.
    if (/api\.openai\.com/i.test(baseUrl)) {
      requestBody.stream_options = { include_usage: true }
    }

    // Add modalities for image generation if specified
    if (modalities && Array.isArray(modalities)) {
      requestBody.modalities = modalities
    }

    // Add reasoning for thinking models if specified
    if (reasoning) {
      requestBody.reasoning = reasoning
    }

    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('Invalid base URL')
    }

    const provider = getProviderById('openai')
    const response = await fetch(`${baseUrl}${provider.chatEndpoint}`, {
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
      const errorMessage = getErrorMessageFromResponse(response, errorData, 'OpenAI-compatible API')

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

        // SSE format: "data: {json}"
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.substring(6) // Remove "data: " prefix

          // Check for end of stream
          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.usage) usage = parsed.usage

            // Extract content from delta
            const delta = parsed.choices?.[0]?.delta

            // Reasoning field names differ between OpenAI-compatible providers.
            // Check the configured key list; use the first string value found.
            let reasoningText = null
            for (const key of DELTA_KEYS.reasoning) {
              const value = delta?.[key]
              if (typeof value === 'string' && value) {
                reasoningText = value
                break
              }
            }

            // Process reasoning tokens
            if (reasoningText && onReasoningChunk) {
              fullReasoning += reasoningText
              onReasoningChunk(reasoningText, fullReasoning)
            }

            const content = getDeltaValue(delta, DELTA_KEYS.content)

            // When content starts, reasoning is complete
            if (content && fullReasoning && !reasoningDone && onReasoningComplete) {
              onReasoningComplete()
              reasoningDone = true
            }

            // Handle regular content
            if (typeof content === 'string' && content) {
              fullContent += content
              onChunk(content, fullContent)
            }

            // Handle tool/function calls (for future implementation)
            if (getDeltaValue(delta, DELTA_KEYS.toolCalls)) {
              // TODO: Implement proper tool call handling
              // For now, log and continue
            }

            // Check for image_url type content (multimodal responses)
            if (Array.isArray(content)) {
              for (const part of content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                  const imageMarkdown = `\n![Generated Image](${part.image_url.url})\n`
                  fullContent += imageMarkdown
                  onChunk(imageMarkdown, fullContent)
                }
              }
            }

            // Handle OpenRouter image generation response format
            // Images are returned in delta.images array
            const images = getDeltaValue(delta, DELTA_KEYS.images)
            if (Array.isArray(images)) {
              for (const image of images) {
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
            const messageImages = getDeltaValue(message, DELTA_KEYS.images)
            if (Array.isArray(messageImages)) {
              for (const image of messageImages) {
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

            // Keep reading after finish_reason so a trailing usage chunk in the
            // same network read is still captured. The stream ends on [DONE] or
            // reader completion.
          } catch (parseError) {
            // Log parsing errors but continue processing other chunks
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
      onComplete(fullContent, { usage: normalizeOpenAIUsage(usage) })
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
        onComplete(fullContent, { usage: normalizeOpenAIUsage(usage) })
      }

      return
    }

    // Handle network errors and other unexpected errors
    const errorMessage = handleNetworkError(error, 'OpenAI-compatible API')
    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendStreamingMessage
}
