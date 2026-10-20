import { REQUEST_TIMEOUT, formatContextWindow } from '@/core/model/ModelUtils'
import { MODEL_ENDPOINT_CANDIDATES } from '@/config/providers'

const FALLBACK_TIMEOUT = 5000

function buildModelUrls(providerConfig) {
  const baseUrl = (providerConfig.apiBaseUrl || '').replace(/\/+$/, '')
  const endpoint = providerConfig.modelsEndpoint || '/models'
  const primary = /^https?:\/\//i.test(endpoint)
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const urls = [primary]
  try {
    const origin = new URL(baseUrl).origin
    for (const path of MODEL_ENDPOINT_CANDIDATES) {
      urls.push(`${origin}${path}`)
    }
  } catch {
    // Invalid base URL; the primary attempt will report the error.
  }

  return [...new Set(urls)]
}

function metadataScore(model) {
  if (!model || typeof model !== 'object') return 0

  const architecture = model.architecture || {}
  const capabilities = model.capabilities || {}
  const tags = model.metadata?.tags || model.tags || []
  const description = model.description || model.metadata?.description
  const context = model.context_window ??
    model.context_length ??
    model.max_context_length ??
    model.contextLength ??
    model.context_size ??
    model.metadata?.context_length ??
    model.metadata?.max_tokens ??
    model.limits?.max_context_length
  const hasModalities = Boolean(
    model.input_modalities ||
    model.inputModalities ||
    model.output_modalities ||
    model.outputModalities ||
    architecture.input_modalities ||
    architecture.output_modalities ||
    architecture.modality
  )
  const tagVision = Array.isArray(tags) &&
    tags.some(tag => /vision|image/i.test(String(tag)))
  const hasCapabilities = capabilities.vision != null ||
    capabilities.completion_chat != null ||
    model.supportsImageInput != null ||
    model.supports_image_input != null ||
    tagVision

  let score = 0
  if (context != null) score += 1
  if (description) score += 1
  if (hasModalities) score += 2
  if (hasCapabilities) score += 1
  return score
}

function hasUsefulModelMetadata(models) {
  return models.some(model => metadataScore(model) >= 2)
}

function mergeModels(primaryModels, richerModels) {
  const primaryById = new Map(
    primaryModels.map(model => [model.id || model.name, model])
  )

  return richerModels.map(model => {
    const base = primaryById.get(model.id || model.name)
    if (!base) return model

    return {
      ...base,
      ...model,
      description: model.description || base.description,
      context_window: model.context_window ?? base.context_window,
      context_length: model.context_length ?? base.context_length,
      max_context_length: model.max_context_length ?? base.max_context_length,
      contextLength: model.contextLength ?? base.contextLength,
      context_size: model.context_size ?? base.context_size,
      input_modalities: model.input_modalities ?? base.input_modalities,
      output_modalities: model.output_modalities ?? base.output_modalities,
      architecture: model.architecture || base.architecture
    }
  })
}

function normalizeModels(models) {
  return models.map(model => {
    if (typeof model === 'string') {
      return {
        id: model,
        name: model,
        contextWindow: formatContextWindow(null),
        description: '',
        pricing: null
      }
    }

    const architecture = model.architecture || {}
    const modality = architecture.modality || model.modality
    let modalityInput = null
    let modalityOutput = null
    if (typeof modality === 'string' && modality.trim()) {
      const parts = modality.split('->').map(part => part.trim())
      const splitModalities = (value) => value
        ? value.split('+').map(item => item.trim()).filter(Boolean)
        : null
      modalityInput = splitModalities(parts[0])
      modalityOutput = splitModalities(parts[1] || parts[0])
    }

    const vision = model.capabilities?.vision === true ||
      model.supportsImageInput === true ||
      model.supports_image_input === true ||
      (Array.isArray(model.metadata?.tags) &&
        model.metadata.tags.some(tag => /vision|image/i.test(String(tag))))
    const completionChat = model.capabilities?.completion_chat === true

    const inputModalities = model.input_modalities ||
      model.inputModalities ||
      architecture.input_modalities ||
      modalityInput ||
      (vision ? ['text', 'image'] : completionChat ? ['text'] : null)
    const outputModalities = model.output_modalities ||
      model.outputModalities ||
      architecture.output_modalities ||
      modalityOutput ||
      (completionChat ? ['text'] : null)

    return {
      id: model.id || model.name,
      name: model.name || model.displayName || model.display_name || model.title || model.id,
      contextWindow: formatContextWindow(
        model.context_window ||
        model.context_length ||
        model.max_context_length ||
        model.contextLength ||
        model.context_size ||
        model.metadata?.context_length ||
        model.metadata?.max_tokens ||
        model.limits?.max_context_length ||
        model.max_tokens
      ),
      description: model.description || model.metadata?.description || '',
      pricing: null,
      ...(inputModalities?.length ? { inputModalities } : {}),
      ...(outputModalities?.length ? { outputModalities } : {})
    }
  })
}

async function requestJson(url, headers, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText
      }
    }

    return { ok: true, data: await response.json() }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch models from custom provider.
 *
 * Starts with the provider's configured /models endpoint. If that response has
 * no useful metadata, tries a small set of generic catalog paths on the same
 * origin (e.g. a richer public model catalog).
 */
export async function fetchCustomProviderModels(providerConfig, apiKey) {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (providerConfig.authHeaderKey && providerConfig.authHeaderValue) {
    headers[providerConfig.authHeaderKey] = providerConfig.authHeaderValue.replace('{key}', apiKey)
  }

  const urls = buildModelUrls(providerConfig)
  let primaryModels = null
  let fallbackModels = null
  let lastError = null

  for (let index = 0; index < urls.length; index++) {
    const isPrimary = index === 0

    try {
      const result = await requestJson(
        urls[index],
        headers,
        isPrimary ? REQUEST_TIMEOUT : FALLBACK_TIMEOUT
      )

      if (!result.ok) {
        if (isPrimary && [401, 403, 429].includes(result.status)) {
          const message = result.status === 429
            ? 'Rate limited. Please try again later.'
            : 'Invalid API key for custom provider.'
          throw Object.assign(new Error(message), { status: result.status })
        }

        lastError = Object.assign(
          new Error(`Failed to fetch models: ${result.statusText}`),
          { status: result.status }
        )
        continue
      }

      // Try to normalize the response (data array, models array, or raw array)
      const models = result.data?.data || result.data?.models || result.data

      if (!Array.isArray(models)) {
        lastError = new Error('Unexpected API response format')
        continue
      }

      if (isPrimary) primaryModels = models

      if (hasUsefulModelMetadata(models)) {
        if (primaryModels && !isPrimary) {
          return normalizeModels(mergeModels(primaryModels, models))
        }
        return normalizeModels(models)
      }

      if (!fallbackModels) fallbackModels = models
    } catch (error) {
      if (error.name === 'AbortError') {
        if (isPrimary) {
          throw Object.assign(
            new Error('Request timeout. Please check your connection.'),
            { name: 'AbortError' }
          )
        }
        lastError = error
        continue
      }

      if (isPrimary && error.status) throw error
      lastError = error
    }
  }

  if (fallbackModels) return normalizeModels(fallbackModels)
  throw lastError || new Error('Failed to fetch models')
}
