import { useState, useEffect } from 'react'
import { Minus as MinimizeIcon, Square as MaximizeIcon, X as CloseIcon, Copy as RestoreIcon } from 'lucide-react'
import iconSvg from '/icon.svg'

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    if (window.electronAPI) {
      // Get initial maximized state
      window.electronAPI.window.isMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.window.minimize()
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.window.maximize()
      // Toggle state
      setIsMaximized(!isMaximized)
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.window.close()
    }
  }

  // Only render in Electron
  if (!window.electronAPI) {
    return null
  }

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
