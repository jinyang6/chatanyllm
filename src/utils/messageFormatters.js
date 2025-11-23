/**
 * Utility functions for message formatting
 */

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
 * @returns {Object} Formatted message for API
 */
export function formatMessageForAPI(message, attachments = []) {
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
    } else {
      // Non-image file attachment (future support)
      contentParts.push({
        type: 'text',
        text: `[Attached file: ${attachment.name} (${attachment.type}, ${formatFileSize(attachment.size)})]`
      })
    }
  }

  return { role: message.role || 'user', content: contentParts }
}

/**
 * Convert message history to API format, handling attachments
 * @param {Array} messages - Array of message objects
 * @returns {Array} Formatted messages for API
 */
export function formatMessagesForAPI(messages) {
  return messages.map(m => {
    // Handle messages with attachments
    if (m.attachments && m.attachments.length > 0) {
      return formatMessageForAPI(m, m.attachments)
    }
    // Simple text message
    return { role: m.role, content: m.content }
  })
}
