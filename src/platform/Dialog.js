import { isElectron } from '@/platform/ElectronBridge'

/**
 * Native dialog operations (open/save file)
 * Provides unified interface for desktop and error handling
 */

export const dialog = {
  async openFile(options = {}) {
    if (!isElectron()) {
      throw new Error('Dialog is only available in desktop mode')
    }
    return window.electronAPI.dialog.openFile(options)
  },

  async saveFile(options = {}) {
    if (!isElectron()) {
      throw new Error('Dialog is only available in desktop mode')
    }
    return window.electronAPI.dialog.saveFile(options)
  }
}

export default dialog
