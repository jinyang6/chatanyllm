// Model fetcher service entry point
import { fetchOpenRouterModels } from './providers/openrouter/modelFetcher'
import { fetchOpenAIModels } from './providers/openai/modelFetcher'
import { fetchGeminiModels } from './providers/gemini/modelFetcher'
import { fetchAnthropicModels } from './providers/anthropic/modelFetcher'
import { fetchCustomProviderModels } from './providers/custom/modelFetcher'

/**
 * Main fetch function - routes to appropriate provider fetcher
 */
export async function fetchModelsForProvider(providerId, apiKey, customProviderConfig = null) {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  switch (providerId) {
    case 'openrouter':
      return await fetchOpenRouterModels(apiKey)

    case 'openai':
      return await fetchOpenAIModels(apiKey)

    case 'gemini':
      return await fetchGeminiModels(apiKey)

    case 'anthropic':
      return await fetchAnthropicModels(apiKey)

    default:
      // Custom provider
      if (customProviderConfig) {
        return await fetchCustomProviderModels(customProviderConfig, apiKey)
      }
      throw new Error(`Unknown provider: ${providerId}`)
  }
}
