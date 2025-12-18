import { useState, useEffect } from 'react'
import { Minus as MinimizeIcon, Square as MaximizeIcon, X as CloseIcon, Copy as RestoreIcon } from 'lucide-react'
import iconSvg from '/icon.svg'

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [shouldRenderCustom, setShouldRenderCustom] = useState(true)

  useEffect(() => {
    // Check if running in Electron
    if (window.electronAPI) {
      const checkPlatform = async () => {
        const platform = window.electronAPI.platform

        if (platform === 'darwin') {
          // macOS uses native traffic lights
          setShouldRenderCustom(false)
          return
        }

        // Windows and Linux use custom titlebar (like VS Code)
        setShouldRenderCustom(true)

        // Get initial maximized state
        const maximized = await window.electronAPI.window.isMaximized()
        setIsMaximized(maximized)
      }

      checkPlatform()

      // Subscribe to window state changes
      const cleanup = window.electronAPI.window.onStateChange((maximized) => {
        setIsMaximized(maximized)
      })

      return cleanup
    }
  }, [])

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.window.minimize()
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.window.maximize()
      // Verify actual state after action
      const actualState = await window.electronAPI.window.isMaximized()
      setIsMaximized(actualState)
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.window.close()
    }
  }

  // Only render custom titlebar in Electron (not on macOS with native traffic lights)
  if (!window.electronAPI || !shouldRenderCustom) {
    return null
  }

  // Windows and Linux: Full custom titlebar with controls (VS Code approach)
  return (
    <div className="h-8 bg-background flex items-center justify-between select-none titlebar-drag">
      {/* App Icon */}
      <div className="flex items-center h-full pl-2 titlebar-no-drag">
        <img src={iconSvg} alt="ChatAnyLLM" className="h-5 w-5" />
      </div>

      {/* Window controls */}
      <div className="flex h-full titlebar-no-drag">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-accent transition-colors"
          title="Minimize"
        >
          <MinimizeIcon className="h-3.5 w-3.5 text-foreground" />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-accent transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <RestoreIcon className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <MaximizeIcon className="h-3.5 w-3.5 text-foreground" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
