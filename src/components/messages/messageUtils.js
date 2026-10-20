// ─── Module-scope pure utilities ─────────────────────────────────────────────

export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export const formatModelName = (model) => {
  if (!model) return ''
  const parts = model.split('/')
  return parts[parts.length - 1]
}

export const formatDuration = (ms) => {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 59950) return `${(ms / 1000).toFixed(1)}s`

  const totalSeconds = Math.round(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${seconds}s`
}

export const formatNumber = (value) => {
  if (value == null || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

export const formatTokensPerSecond = (value) => {
  if (value == null || !Number.isFinite(value) || value < 0) return ''
  return `${value.toFixed(value < 100 ? 1 : 0)} tok/s`
}

/**
 * Derive the values shown in the UI from the minimal stored metrics.
 */
export const getMetricsView = (metrics) => {
  if (!metrics?.startedAt || !metrics?.completedAt) return null

  const start = new Date(metrics.startedAt).getTime()
  const end = new Date(metrics.completedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null

  const durationMs = Math.max(0, end - start)
  const ttftMs = metrics.ttftMs ?? null
  const generationMs = Math.max(0, durationMs - (ttftMs || 0))
  const completionTokens = metrics.usage?.completionTokens ?? null
  const tokensPerSecond = completionTokens != null && generationMs > 0
    ? completionTokens / (generationMs / 1000)
    : null

  return {
    durationMs,
    ttftMs,
    generationMs,
    completionTokens,
    tokensPerSecond
  }
}

// Matches inline base64 generated images (current session, new messages)
export const IMAGE_INLINE_REGEX = /\[GENERATED_IMAGE:(.*?):END_IMAGE\]/gs
// Matches file-path generated images (loaded from disk, new format)
export const IMAGE_FILE_REGEX = /\[GENERATED_IMAGE_FILE:(.*?):END_IMAGE\]/gs

export const parseGeneratedImages = (content) => {
  IMAGE_INLINE_REGEX.lastIndex = 0
  IMAGE_FILE_REGEX.lastIndex = 0

  const images = [] // { src: string, isFilePath: boolean }

  let match
  while ((match = IMAGE_INLINE_REGEX.exec(content)) !== null) {
    images.push({ src: match[1], isFilePath: false })
  }
  while ((match = IMAGE_FILE_REGEX.exec(content)) !== null) {
    images.push({ src: match[1], isFilePath: true })
  }

  const cleanContent = content
    .replace(IMAGE_INLINE_REGEX, '')
    .replace(IMAGE_FILE_REGEX, '')
    .trim()

  return { cleanContent, images }
}
