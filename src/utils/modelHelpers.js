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
