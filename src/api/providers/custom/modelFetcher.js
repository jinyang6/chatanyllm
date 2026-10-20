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

function scoreModels(models) {
  if (models.length === 0) return 0
  return models.reduce((sum, model) => sum + metadataScore(model), 0) / models.length
}

function mergeModels(baseModels, extraModels) {
  const extraById = new Map(
    extraModels.map(model => [model.id || model.name, model])
  )

  const merged = baseModels.map(base => {
    const key = base.id || base.name
    const extra = extraById.get(key)
    if (!extra) return base
    extraById.delete(key)

    return {
      ...base,
      ...extra,
      description: extra.description || base.description,
      context_window: extra.context_window ?? base.context_window,
      context_length: extra.context_length ?? base.context_length,
      max_context_length: extra.max_context_length ?? base.max_context_length,
      contextLength: extra.contextLength ?? base.contextLength,
      context_size: extra.context_size ?? base.context_size,
      input_modalities: extra.input_modalities ?? base.input_modalities,
      output_modalities: extra.output_modalities ?? base.output_modalities,
      architecture: extra.architecture
        ? { ...(base.architecture || {}), ...extra.architecture }
        : base.architecture,
      capabilities: extra.capabilities
        ? { ...(base.capabilities || {}), ...extra.capabilities }
        : base.capabilities,
      limits: extra.limits
        ? { ...(base.limits || {}), ...extra.limits }
        : base.limits
    }
  })

  return [...merged, ...extraById.values()]
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

function abortError() {
  return Object.assign(
    new Error('Request timeout. Please check your connection.'),
    { name: 'AbortError' }
  )
}

/**
 * Fetch models from custom provider.
 *
 * Queries the configured /models endpoint and a generic set of richer catalog
 * paths in parallel, then merges all successful results. This keeps perceived
 * latency at roughly the slowest single request instead of summing timeouts.
 */
export async function fetchCustomProviderModels(providerConfig, apiKey) {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (providerConfig.authHeaderKey && providerConfig.authHeaderValue) {
    headers[providerConfig.authHeaderKey] = providerConfig.authHeaderValue.replace('{key}', apiKey)
  }

  const urls = buildModelUrls(providerConfig)
  const settled = await Promise.allSettled(
    urls.map((url, index) => requestJson(
      url,
      headers,
      index === 0 ? REQUEST_TIMEOUT : FALLBACK_TIMEOUT
    ))
  )

  const results = settled.map((outcome, index) => ({
    outcome,
    isPrimary: index === 0
  }))

  // Invalid keys and rate limits on the actual provider endpoint are fatal,
  // even if a public catalog endpoint happened to answer.
  const primary = results[0].outcome
  if (primary.status === 'fulfilled' && !primary.value.ok &&
    [401, 403, 429].includes(primary.value.status)) {
    const message = primary.value.status === 429
      ? 'Rate limited. Please try again later.'
      : 'Invalid API key for custom provider.'
    throw Object.assign(new Error(message), { status: primary.value.status })
  }

  const lists = []
  let lastError = null

  for (const { outcome } of results) {
    if (outcome.status === 'rejected') {
      lastError = outcome.reason
      continue
    }

    if (!outcome.value.ok) {
      lastError = Object.assign(
        new Error(`Failed to fetch models: ${outcome.value.statusText}`),
        { status: outcome.value.status }
      )
      continue
    }

    // Accept data arrays, models arrays, or raw arrays.
    const models = outcome.value.data?.data ||
      outcome.value.data?.models ||
      outcome.value.data

    if (!Array.isArray(models)) {
      lastError = new Error('Unexpected API response format')
      continue
    }

    lists.push({ models, score: scoreModels(models) })
  }

  if (lists.length === 0) {
    if (primary.status === 'rejected' && primary.reason?.name === 'AbortError') {
      throw abortError()
    }
    throw lastError || new Error('Failed to fetch models')
  }

  // Merge from least rich to richest. Provider data wins only when it scores
  // higher; otherwise richer catalog fields fill the gaps.
  lists.sort((a, b) => a.score - b.score)

  let models = lists[0].models
  for (let index = 1; index < lists.length; index++) {
    models = mergeModels(models, lists[index].models)
  }

  return normalizeModels(models)
}
