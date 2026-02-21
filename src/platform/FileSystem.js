import { isElectron } from '@/platform/ElectronBridge'
import { dialog } from '@/platform/Dialog'

/**
 * Low-level file system operations wrapper
 * Provides unified interface for desktop (Electron fs) and error handling
 */

export const fileSystem = {
  async readFile(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.readFile(filePath)
  },

  async writeFile(filePath, content) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.writeFile(filePath, content)
  },

  async deleteFile(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.deleteFile(filePath)
  },

  async readDir(dirPath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.readDir(dirPath)
  },

  async exists(filePath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.exists(filePath)
  },

  async mkdir(dirPath) {
    if (!isElectron()) {
      throw new Error('File system access is only available in desktop mode')
    }
    return window.electronAPI.fs.mkdir(dirPath)
  },

  async writeBinaryFile(filePath, base64Data) {
    if (!isElectron()) {
      throw new Error('Binary file system access is only available in desktop mode')
    }
    return window.electronAPI.fs.writeBinaryFile(filePath, base64Data)
  },

  async saveImage(imageDataUrl, suggestedName = 'image.png') {
    if (!isElectron()) {
      throw new Error('Image save is only available in desktop mode')
    }

    // Show save dialog
    const dialogResult = await dialog.saveFile({
      defaultPath: suggestedName,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (dialogResult.canceled) {
      return { success: false, canceled: true }
    }

    // Write binary file
    const result = await this.writeBinaryFile(dialogResult.filePath, imageDataUrl)

    if (result.success) {
      return { success: true, path: dialogResult.filePath }
    }

    return result
  }
}

export default fileSystem
