import { isElectron, revealInFolder } from '@/platform/ElectronBridge'
import { fileSystem } from '@/platform/FileSystem'
import { showPillToast } from '@/components/ui/toast-pill'

/**
 * Download an image to user's chosen location
 * @param {string} imageUrl - Image data URL or URL
 * @param {string} suggestedName - Suggested filename (default: 'image.png')
 * @returns {Promise<{success: boolean, error?: string, canceled?: boolean}>}
 */
export async function downloadImage(imageUrl, suggestedName = 'image.png') {
  try {
    // Determine filename with proper extension
    let filename = suggestedName
    if (!filename.includes('.')) {
      const urlName = extractFilename(imageUrl, '')
      filename = (urlName && urlName.includes('.')) ? urlName : `${suggestedName}.png`
    }

    // For external URLs, fetch the image bytes first
    let resolvedUrl = imageUrl
    let blobUrl = null

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error(`Failed to load image (HTTP ${response.status})`)
      const blob = await response.blob()

      if (isElectron()) {
        // Convert to data URL for Electron's writeBinaryFile (expects base64)
        resolvedUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Failed to convert image'))
          reader.readAsDataURL(blob)
        })
      } else {
        // Create blob URL (same-origin) so the download attribute works in browser
        blobUrl = URL.createObjectURL(blob)
        resolvedUrl = blobUrl
      }
    }

    if (isElectron()) {
      // Electron: Show save dialog and write binary file
      const result = await fileSystem.saveImage(resolvedUrl, filename)

      if (result.canceled) {
        return { success: false, canceled: true }
      }

      if (result.success) {
        showPillToast('Saved', {
          actionLabel: 'Open',
          onAction: () => revealInFolder(result.path),
          duration: 5000,
        })
        return { success: true, path: result.path }
      } else {
        showPillToast(`Failed to save image: ${result.error || 'Unknown error'}`)
        return { success: false, error: result.error }
      }
    } else {
      // Browser: Trigger download using <a> element
      const link = document.createElement('a')
      link.href = resolvedUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up blob URL after download initiates
      if (blobUrl) {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
      }

      showPillToast('Saved', { duration: 4000 })
      return { success: true }
    }
  } catch (error) {
    console.error('Download error:', error)
    showPillToast(`Failed to download: ${error.message}`)
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

/**
 * Extract filename from any URL (generic, not image-specific)
 * @param {string} url - The URL to extract filename from
 * @param {string} defaultName - Default name if extraction fails
 * @returns {string} - Extracted or default filename
 */
export function extractFilename(url, defaultName = 'download') {
  try {
    if (url.startsWith('data:')) return defaultName
    const pathname = new URL(url).pathname
    const name = pathname.substring(pathname.lastIndexOf('/') + 1)
    return name && name.includes('.') ? name : defaultName
  } catch {
    return defaultName
  }
}
