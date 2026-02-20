/**
 * Electron API wrapper for React components
 * Provides file system access and secure storage in desktop mode
 */

// Check if running in Electron
export const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron
}

// App Info
export const getAppDataPath = async () => {
  if (!isElectron()) {
    return null
  }
  return window.electronAPI.getAppDataPath()
}

export const getPlatform = () => {
  if (!isElectron()) {
    return 'web'
  }
  return window.electronAPI.platform
}

// Signal that the app is ready (shows the window in Electron)
export const signalAppReady = () => {
  if (!isElectron()) {
    return // No-op in browser mode
  }
  window.electronAPI.signalReady()
}

// Shell Operations
export const openExternal = async (url) => {
  if (!isElectron()) {
    // Fallback to window.open in web mode
    window.open(url, '_blank', 'noopener,noreferrer')
    return { success: true }
  }
  return window.electronAPI.shell.openExternal(url)
}

// Check if encryption is available
export const isEncryptionAvailable = async () => {
  if (!isElectron()) {
    return { available: false, platform: 'web' }
  }
  return window.electronAPI.store.isEncryptionAvailable()
}

export default {
  isElectron,
  getAppDataPath,
  getPlatform,
  openExternal,
  isEncryptionAvailable
}
