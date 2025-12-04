import { isElectron, fileSystem, dialog } from '@/lib/electron'
import { toast } from 'sonner'

/**
 * Download an image to user's chosen location
 * @param {string} imageUrl - Image data URL or URL
 * @param {string} suggestedName - Suggested filename (default: 'image.png')
 * @returns {Promise<{success: boolean, error?: string, canceled?: boolean}>}
 */
export async function downloadImage(imageUrl, suggestedName = 'image.png') {
  try {
    // Ensure filename has .png extension
    const filename = suggestedName.endsWith('.png')
      ? suggestedName
      : `${suggestedName}.png`

    if (isElectron()) {
      // Electron: Show save dialog and write binary file
      const result = await fileSystem.saveImage(imageUrl, filename)

      if (result.canceled) {
        return { success: false, canceled: true }
      }

      if (result.success) {
        toast.success(`Image saved to ${result.path}`)
        return { success: true, path: result.path }
      } else {
        toast.error(`Failed to save image: ${result.error || 'Unknown error'}`)
        return { success: false, error: result.error }
      }
    } else {
      // Browser: Trigger download using <a> element
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`Image saved to ${filename}`)
      return { success: true }
    }
  } catch (error) {
    console.error('Download error:', error)
    toast.error(`Failed to download image: ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * Extract filename from image URL or data URL
 * @param {string} imageUrl - Image URL or data URL
 * @param {string} defaultName - Default name if extraction fails
 * @returns {string} - Extracted or default filename
 */
export function extractImageName(imageUrl, defaultName = 'image.png') {
  try {
    // For data URLs, return default
    if (imageUrl.startsWith('data:')) {
      return defaultName
    }

    // For regular URLs, extract filename
    const url = new URL(imageUrl)
    const pathname = url.pathname
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1)

    if (filename && filename.includes('.')) {
      return filename
    }

    return defaultName
  } catch {
    return defaultName
  }
}
