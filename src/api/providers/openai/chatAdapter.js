/**
 * OpenAI-compatible chat adapter
 * Handles: OpenAI, OpenRouter, and all custom OpenAI-compatible providers
 * Updated: 2025-01-15
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

            // Extract content from delta
            const delta = parsed.choices?.[0]?.delta

            // Handle reasoning tokens from multiple possible fields
            // OpenRouter returns reasoning in delta.reasoning for DeepSeek R1 and similar models
            let reasoningText = null

            // Check standard reasoning field
            if (delta?.reasoning) {
              reasoningText = delta.reasoning
            }
            // Check reasoning_details array (alternative structure)
            else if (delta?.reasoning_details && Array.isArray(delta.reasoning_details)) {
              const reasoningParts = delta.reasoning_details
                .filter(part => part.type === 'reasoning.text' && part.text)
                .map(part => part.text)
              if (reasoningParts.length > 0) {
                reasoningText = reasoningParts.join('')
              }
            }

            // Process reasoning tokens
            if (reasoningText && onReasoningChunk) {
              fullReasoning += reasoningText
              onReasoningChunk(reasoningText, fullReasoning)
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

            // Handle tool/function calls (for future implementation)
            if (delta?.tool_calls || delta?.function_call) {
              // TODO: Implement proper tool call handling
              // For now, log and continue
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
              // Stream ended normally
              break
            }
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
    const errorMessage = handleNetworkError(error, 'OpenAI-compatible API')
    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendStreamingMessage
}
