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
