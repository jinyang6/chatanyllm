/**
 * Google Gemini chat adapter
 * Uses Google Generative AI API with streaming
 */

export async function sendStreamingMessage({
  apiKey,
  model,
  messages,
  onChunk,
  onComplete,
  onError,
  abortSignal
}) {
  let fullContent = ''
  let completeCalled = false

  try {
    // Convert messages to Gemini format
    // Gemini uses 'user' and 'model' roles, and 'parts' instead of 'content'
    const contents = messages
      .filter(m => m.role !== 'system') // Gemini doesn't support system messages directly
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    // Handle system message by prepending it to first user message if present
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
    }

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    }

    // Gemini API uses model name in URL and API key as query parameter
    const modelName = model.startsWith('models/') ? model : `models/${model}`
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`

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
                  if (part.text) {
                    fullContent += part.text
                    onChunk(part.text, fullContent)
                  }
                }
              }

              // Check finish reason
              if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                console.warn('Gemini finish reason:', candidate.finishReason)
              }
            }

            // Check for errors
            if (parsed.error) {
              throw new Error(parsed.error.message || 'Unknown error from Gemini')
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

    // Call onComplete only once
    if (!completeCalled) {
      completeCalled = true
      onComplete(fullContent)
    }
  } catch (error) {
    // Check if it was aborted
    if (error.name === 'AbortError') {
      console.log('Stream aborted by user')

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
      errorMessage = 'Network error: Unable to connect to Gemini API. Please check your internet connection.'
    } else if (error.name === 'SyntaxError') {
      errorMessage = 'Invalid response from Gemini API. Please try again.'
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
