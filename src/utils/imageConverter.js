/**
 * Convert any image file to PNG format using Canvas API
 * @param {File} file - Image file from clipboard or file input
 * @returns {Promise<string>} - PNG data URL
 */
export async function convertImageToPNG(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target.result

      img.onload = () => {
        try {
          // Create canvas with image dimensions
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height

          // Draw image to canvas
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)

          // Convert to PNG data URL
          const pngDataUrl = canvas.toDataURL('image/png')
          resolve(pngDataUrl)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Calculate the actual size of a base64 encoded image
 * @param {string} base64String - Base64 data URL
 * @returns {number} - Size in bytes
 */
export function calculateBase64Size(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.split(',')[1] || base64String

  // Calculate size: base64 is ~33% larger than binary
  // Size = (base64_length * 3) / 4
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0
  return (base64Data.length * 3) / 4 - padding
}
