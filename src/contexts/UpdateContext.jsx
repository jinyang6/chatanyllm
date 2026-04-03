import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { isElectron } from '@/platform/ElectronBridge'

const UpdateContext = createContext(null)

export function UpdateProvider({ children }) {
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    version: null,
    releaseNotes: null,
    progress: 0,
    error: null
  })
  const [currentVersion, setCurrentVersion] = useState(null)

  useEffect(() => {
    if (!isElectron()) return

    const fetchVersion = async () => {
      try {
        const v = await window.electronAPI.updater.getVersion()
        setCurrentVersion(v)
        console.log(`[Updater] Current version: ${v}`)
        setUpdateState(prev => ({ ...prev, status: 'checking' }))
        await window.electronAPI.updater.check()
      } catch (err) {
        console.error('Failed to get app version:', err)
        setUpdateState(prev => ({ ...prev, status: 'up-to-date' }))
      }
    }
    fetchVersion()
  }, [])

  useEffect(() => {
    if (!isElectron()) return

    const unsubChecking = window.electronAPI.updater.onChecking(() => {
      setUpdateState(prev => ({ ...prev, status: 'checking', error: null }))
    })

    const unsubAvailable = window.electronAPI.updater.onAvailable((info) => {
      console.log(`[Updater] ${currentVersion} -> ${info.version} (update available)`)
      setUpdateState({
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes,
        progress: 0,
        error: null
      })
    })

    const unsubNotAvailable = window.electronAPI.updater.onNotAvailable((info) => {
      console.log(`[Updater] ${currentVersion} -> ${info.version || currentVersion} (up to date)`)
      setUpdateState(prev => ({ ...prev, status: 'up-to-date' }))
    })

    const unsubError = window.electronAPI.updater.onError((err) => {
      setUpdateState(prev => ({ ...prev, status: 'error', error: err.message }))
    })

    const unsubProgress = window.electronAPI.updater.onProgress((progress) => {
      setUpdateState(prev => ({ ...prev, status: 'downloading', progress: progress.percent }))
    })

    const unsubDownloaded = window.electronAPI.updater.onDownloaded((info) => {
      setUpdateState({
        status: 'ready-to-install',
        version: info.version,
        releaseNotes: info.releaseNotes,
        progress: 100,
        error: null
      })
    })

    return () => {
      unsubChecking()
      unsubAvailable()
      unsubNotAvailable()
      unsubError()
      unsubProgress()
      unsubDownloaded()
    }
  }, [])

  const checkForUpdates = useCallback(async () => {
    if (!isElectron()) return
    setUpdateState(prev => ({ ...prev, status: 'checking', error: null }))
    try {
      await window.electronAPI.updater.check()
    } catch (err) {
      setUpdateState(prev => ({ ...prev, status: 'error', error: err.message }))
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    if (!isElectron()) return
    setUpdateState(prev => ({ ...prev, status: 'downloading', progress: 0 }))
    try {
      await window.electronAPI.updater.download()
    } catch (err) {
      setUpdateState(prev => ({ ...prev, status: 'error', error: err.message }))
    }
  }, [])

  const installUpdate = useCallback(() => {
    if (!isElectron()) return
    window.electronAPI.updater.install()
  }, [])

  return (
    <UpdateContext.Provider value={{
      ...updateState,
      currentVersion,
      checkForUpdates,
      downloadUpdate,
      installUpdate
    }}>
      {children}
    </UpdateContext.Provider>
  )
}

export function useUpdate() {
  const context = useContext(UpdateContext)
  if (!context) {
    return {
      status: 'browser',
      version: null,
      currentVersion: null,
      progress: 0,
      error: null,
      checkForUpdates: () => {},
      downloadUpdate: () => {},
      installUpdate: () => {}
    }
  }
  return context
}