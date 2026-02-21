import { isElectron } from '@/platform/ElectronBridge'

/**
 * Secure storage (for API keys, etc.)
 * Fallback to localStorage in web mode
 */

export const secureStore = {
  async get(key) {
    if (!isElectron()) {
      // Fallback to localStorage in web mode
      const value = localStorage.getItem(key)
      return { success: true, value: value ? JSON.parse(value) : null }
    }
    return window.electronAPI.store.get(key)
  },

  async set(key, value) {
    if (!isElectron()) {
      // Fallback to localStorage in web mode
      localStorage.setItem(key, JSON.stringify(value))
      return { success: true }
    }
    return window.electronAPI.store.set(key, value)
  },

  async delete(key) {
    if (!isElectron()) {
      localStorage.removeItem(key)
      return { success: true }
    }
    return window.electronAPI.store.delete(key)
  },

  async clear() {
    if (!isElectron()) {
      localStorage.clear()
      return { success: true }
    }
    return window.electronAPI.store.clear()
  }
}

export default secureStore
