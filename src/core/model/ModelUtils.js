export const REQUEST_TIMEOUT = 10000 // 10 seconds

/**
 * Shared formatting helpers
 */

export function formatContextWindow(tokens) {
  if (!tokens) return 'Unknown'
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`
  return `${tokens}`
}

export function formatModelName(modelId) {
  // Convert model ID to readable name
  return modelId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Provider-specific formatting helpers (shared or exported)
 */

export function formatGeminiName(name) {
  if (!name) return 'Unknown'
  return name.replace('models/', '').replace(/-/g, ' ')
}

export function formatAnthropicName(name) {
  if (!name) return 'Unknown'
  // Convert "claude-3-5-sonnet-20241022" to "Claude 3.5 Sonnet"
  const parts = name.split('-')
  if (parts[0] === 'claude') {
    // Extract version and model name
    const versionParts = []
    const nameParts = []
    let foundVersion = false

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      // Check if it's a number or date
      if (!isNaN(part) && part.length <= 2 && !foundVersion) {
        versionParts.push(part)
      } else if (part.length === 8 && !isNaN(part)) {
        // Date part, skip
        break
      } else {
        foundVersion = true
        nameParts.push(part.charAt(0).toUpperCase() + part.slice(1))
      }
    }

    if (versionParts.length > 0 && nameParts.length > 0) {
      return `Claude ${versionParts.join('.')} ${nameParts.join(' ')}`
    }
  }
  // Fallback
  return name.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Utility functions for model detection and configuration
 */

/**
 * Detect if a model is a "thinking" model (has reasoning capabilities)
 * Uses OpenRouter API metadata to dynamically detect reasoning support.
 *
 * @param {string} modelId - The model identifier
 * @param {Array} availableModels - Array of available model configurations from API
 * @returns {boolean} True if model supports reasoning
 */
export function isThinkingModel(modelId, availableModels = []) {
  if (!modelId) return false

  // Always check API metadata first - this is the source of truth
  const modelData = availableModels.find(m => m.id === modelId)
  if (modelData && modelData.supportsReasoning) {
    return true
  }

  // If model is not in the fetched list, we cannot determine if it supports reasoning
  // Return false to avoid incorrect assumptions
  return false
}

/**
 * Detect if a model supports image generation
 * @param {string} modelId - The model identifier
 * @param {Array} availableModels - Array of available model configurations
 * @returns {boolean} True if model can generate images
 */
export function isImageGenerationModel(modelId, availableModels = []) {
  if (!modelId) return false
  const modelData = availableModels.find(m => m.id === modelId)
  return modelData?.outputModalities?.includes('image') || false
}

/**
 * Get modalities configuration for a model
 * @param {string} modelId - The model identifier
 * @param {Array} availableModels - Array of available model configurations
 * @returns {Array|null} Modalities array or null
 */
export function getModalitiesForModel(modelId, availableModels = []) {
  const modelData = availableModels.find(m => m.id === modelId)
  if (modelData?.outputModalities?.includes('image')) {
    return ['image', 'text']
  }
  return null
}

/**
 * Get reasoning configuration for thinking models
 * @param {string} modelId - The model identifier
 * @returns {Object|null} Reasoning config or null
 */
export function getReasoningConfig(modelId) {
  return isThinkingModel(modelId) ? { effort: 'high' } : null
}
