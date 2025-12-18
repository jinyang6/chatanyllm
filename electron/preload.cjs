const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  fs: {
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    writeBinaryFile: (filePath, base64Data) => ipcRenderer.invoke('fs:writeBinaryFile', filePath, base64Data),
    deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
    readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
    exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
    mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath)
  },

  // Dialog operations
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options)
  },

  // Secure storage
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear'),
    isEncryptionAvailable: () => ipcRenderer.invoke('store:isEncryptionAvailable')
  },

  // Shell operations
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (callback) => {
      const subscription = (event, isMaximized) => callback(isMaximized)
      ipcRenderer.on('window-state-changed', subscription)
      // Return cleanup function
      return () => ipcRenderer.removeListener('window-state-changed', subscription)
    }
  },

  // App info
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // App lifecycle
  signalReady: () => ipcRenderer.invoke('app:ready'),

  // Platform info
  platform: process.platform,
  isElectron: true,

  // OS version detection for conditional UI rendering
  isWindows11: () => {
    if (process.platform !== 'win32') return false
    const os = require('os')
    const buildNumber = parseInt(os.release().split('.')[2] || '0')
    return buildNumber >= 22000
  }
})

console.log('Electron preload script loaded')
