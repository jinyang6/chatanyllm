/**
 * Utility functions for model detection and configuration
 */

/**
 * Detect if a model is a "thinking" model (has reasoning capabilities)
 * @param {string} modelId - The model identifier
 * @returns {boolean} True if model supports reasoning
 */
export function isThinkingModel(modelId) {
  if (!modelId) return false
  const lowerModel = modelId.toLowerCase()
  return (
    lowerModel.includes('o1') ||
    lowerModel.includes('o3') ||
    lowerModel.includes('claude-3.7-sonnet') ||
    lowerModel.includes('claude-3-7-sonnet') ||
    lowerModel.includes('gemini-2.0-flash-thinking') ||
    lowerModel.includes('thinking')
  )
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
