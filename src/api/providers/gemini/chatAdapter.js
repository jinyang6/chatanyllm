/**
 * Google Gemini chat adapter
 * Uses Google Generative AI API with streaming
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
  temperature = 0.7,
  maxTokens = 8192,
  topP = null,
  topK = null
}) {
  let fullContent = ''
  let fullReasoning = ''
  let reasoningDone = false
  let completeCalled = false

  try {
    // Validate required parameters
    validateChatParams({ apiKey, model, messages })

    // Use provided baseUrl or fall back to config
    const provider = getProviderById('gemini')
    const apiBase = (baseUrl || provider.apiBaseUrl).replace(/\/$/, '')

    // Convert messages to Gemini format
    // Gemini uses 'user' and 'model' roles, and 'parts' instead of 'content'
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    // Handle system message by prepending it to first user message if present
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
    }

    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens
    }

    // Add optional parameters
    if (topP !== null) generationConfig.topP = topP
    if (topK !== null) generationConfig.topK = topK

    const requestBody = {
      contents,
      generationConfig
    }

    // Gemini API uses model name in URL and API key as query parameter
    const modelName = model.startsWith('models/') ? model : `models/${model}`
    const url = `${apiBase}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse` // path pattern from provider.chatEndpoint

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = getErrorMessageFromResponse(response, errorData, 'Gemini API')

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

        // Skip empty lines
        if (!trimmedLine) continue

        // SSE format: "data: {json}"
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.substring(6) // Remove "data: " prefix

          try {
            const parsed = JSON.parse(data)

            // Extract text from candidates
            const candidates = parsed.candidates
            if (candidates && candidates.length > 0) {
              const candidate = candidates[0]
              const content = candidate.content

              if (content && content.parts) {
                for (const part of content.parts) {
                  // Handle thinking/reasoning parts for Gemini 2.0 Flash Thinking
                  if (part.thought && onReasoningChunk) {
                    fullReasoning += part.thought
                    onReasoningChunk(part.thought, fullReasoning)
                  }
                  // Handle regular text content
                  else if (part.text) {
                    // If we had reasoning and now getting content, mark reasoning complete
                    if (fullReasoning && !reasoningDone && onReasoningComplete) {
                      onReasoningComplete()
                      reasoningDone = true
                    }
                    fullContent += part.text
                    onChunk(part.text, fullContent)
                  }
                }
              }

              // Check finish reason
              if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Gemini finish reason:', candidate.finishReason)
                }
              }
            }

            // Check for errors
            if (parsed.error) {
              throw new Error(parsed.error.message || 'Unknown error from Gemini')
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
    // Categorize the error for better user feedback
    const errorMessage = handleNetworkError(error, 'Gemini API')

    const wrappedError = new Error(errorMessage)
    onError(wrappedError)
  }
}

export default {
  sendStreamingMessage
}
