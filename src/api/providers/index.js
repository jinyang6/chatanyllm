import * as openai from './openai/chatAdapter'
import * as anthropic from './anthropic/chatAdapter'
import * as gemini from './gemini/chatAdapter'
import * as openrouter from './openrouter/chatAdapter'
import * as custom from './custom/chatAdapter'

export const adapters = {
  openai,
  anthropic,
  gemini,
  openrouter,
  custom
}
