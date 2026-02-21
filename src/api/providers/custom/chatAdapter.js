import { sendStreamingMessage as sendOpenAIMessage } from '../openai/chatAdapter'

/**
 * Custom provider chat adapter
 * All custom providers are treated as OpenAI-compatible
 */
export async function sendStreamingMessage(params) {
  return sendOpenAIMessage(params)
}

export default {
  sendStreamingMessage
}
