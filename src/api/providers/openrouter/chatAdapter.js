import { sendStreamingMessage as sendOpenAIMessage } from '../openai/chatAdapter'

export async function sendStreamingMessage(params) {
  // OpenRouter is OpenAI-compatible but often uses a different base URL
  return sendOpenAIMessage(params)
}

export default {
  sendStreamingMessage
}
