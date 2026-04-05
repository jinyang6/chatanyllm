/**
 * Utility functions for message formatting
 */

// Text-based file extensions that can be decoded and sent as raw content
const TEXT_BASED_EXTENSIONS = new Set([
  'mjs', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp',
  'go', 'rs', 'rb', 'php', 'sql', 'sh', 'bash', 'zsh', 'yaml', 'yml',
  'xml', 'json', 'jsonc', 'csv', 'md', 'mdx', 'txt', 'text', 'log',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
  'kt', 'swift', 'gradle', 'properties', 'env', 'gitignore', 'dockerfile',
  'toml', 'ini', 'cfg', 'conf', 'makefile', 'cmake', 'rakefile',
  'pl', 'r', 'lua', 'nim', 'zig', 'dart', 'elm', 'ex', 'exs', 'erl',
  'hs', 'scala', 'groovy', 'gradle', 'bat', 'ps1', 'vbs', 'ahk'
])

// File types that use OpenAI's type: 'file' format with file_data
// OpenRouter and other OpenAI-compatible providers support this for PDFs, docs, etc.
const FILE_TYPE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'xlsb',
  'odt', 'odp', 'ods', 'rtf', 'pages'
])

// Max text file size before warning (500KB)
const MAX_TEXT_FILE_SIZE = 500 * 1024

/**
 * Get file extension from filename
 * @param {string} filename
 * @returns {string} extension without dot, or empty string
 */
function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Check if a file is text-based and can be decoded as raw text
 * @param {string} filename
 * @returns {boolean}
 */
export function isTextBasedFile(filename) {
  return TEXT_BASED_EXTENSIONS.has(getFileExtension(filename))
}

/**
 * Check if a file should be sent as type: 'file' (OpenAI file input format)
 * @param {string} filename
 * @returns {boolean}
 */
export function isFileTypeFile(filename) {
  return FILE_TYPE_EXTENSIONS.has(getFileExtension(filename))
}

/**
 * Decode base64 data URL to text string
 * @param {string} base64Data - base64 encoded data (with or without data URL prefix)
 * @returns {string} decoded text
 */
export function decodeBase64ToText(base64Data) {
  // Strip data URL prefix if present
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, '')
  try {
    return atob(base64)
  } catch {
    return '[Unable to decode file content]'
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Convert a message with attachments into multimodal API format
 * @param {Object} message - Message object with role and content
 * @param {Array} attachments - Array of attachment objects
 * @returns {Promise<Object>} Formatted message for API
 */
export async function formatMessageForAPI(message, attachments = []) {
  // Simple text message - no attachments
  if (!attachments || attachments.length === 0) {
    return { role: message.role || 'user', content: message.content }
  }

  // Multimodal message format
  const contentParts = []

  // Add text first if present
  if (message.content && message.content.trim()) {
    contentParts.push({ type: 'text', text: message.content })
  }

  // Add attachments
  for (const attachment of attachments) {
    if (attachment.isImage) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: attachment.data,
          detail: 'auto'
        }
      })
    } else if (isTextBasedFile(attachment.name)) {
      // Read text-based file content from base64 and inject as markdown code block
      const textContent = decodeBase64ToText(attachment.data)

      // Truncate if too large and add warning
      let displayContent = textContent
      if (textContent.length > MAX_TEXT_FILE_SIZE) {
        displayContent = textContent.slice(0, MAX_TEXT_FILE_SIZE) +
          '\n[... file truncated, exceeded ' + formatFileSize(MAX_TEXT_FILE_SIZE) + ' limit ...]'
      }

      const ext = getFileExtension(attachment.name)
      const language = ext || 'text'

      contentParts.push({
        type: 'text',
        text: `[File Attached: ${attachment.name}]\n\`\`\`${language}\n${displayContent}\n\`\`\``
      })
    } else if (isFileTypeFile(attachment.name)) {
      // Send as OpenAI type: 'file' format — supported by OpenRouter and other providers
      // OpenRouter auto-parses these files (PDFs, docs, spreadsheets)
      contentParts.push({
        type: 'file',
        file: {
          filename: attachment.name,
          file_data: attachment.data  // base64 data URL
        }
      })
    } else {
      // Binary or unsupported file - send placeholder only
      contentParts.push({
        type: 'text',
        text: `[Attached file: ${attachment.name} (${attachment.type}, ${formatFileSize(attachment.size)}) - Content not supported]`
      })
    }
  }

  return { role: message.role || 'user', content: contentParts }
}

// Strip generated image blobs from content before sending to API.
// Both inline base64 markers and file-path markers are replaced with a plain text note.
const GENERATED_IMAGE_INLINE_RE = /\[GENERATED_IMAGE:data:image\/\w+;base64,[^\]]+:END_IMAGE\]/g
const GENERATED_IMAGE_FILE_RE = /\[GENERATED_IMAGE_FILE:[^\]]+:END_IMAGE\]/g

function stripGeneratedImages(content) {
  return content
    .replace(GENERATED_IMAGE_INLINE_RE, '[generated image]')
    .replace(GENERATED_IMAGE_FILE_RE, '[generated image]')
    .trim()
}

/**
 * Convert message history to API format, handling attachments
 * @param {Array} messages - Array of message objects
 * @returns {Promise<Array>} Formatted messages for API
 */
export async function formatMessagesForAPI(messages) {
  const results = []
  for (const m of messages) {
    const content = stripGeneratedImages(m.content || '')
    if (m.attachments && m.attachments.length > 0) {
      results.push(await formatMessageForAPI({ ...m, content }, m.attachments))
    } else {
      results.push({ role: m.role, content })
    }
  }
  return results
}
