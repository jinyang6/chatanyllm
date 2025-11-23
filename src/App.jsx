import { useState, useEffect } from 'react'
import { ProviderProvider } from './contexts/ProviderContext'
import { ConversationProvider } from './contexts/ConversationContext'
import { ErrorProvider } from './contexts/ErrorContext'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import SettingsModal from './components/SettingsModal'
import { isElectron } from './lib/electron'

function App() {
  const [currentConversation, setCurrentConversation] = useState('conv-1')
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Log startup mode
  useEffect(() => {
    const electronMode = isElectron()
    console.log('=== ChatAnyLLM Startup ===')
    console.log('Running in:', electronMode ? 'ELECTRON MODE (file system)' : 'BROWSER MODE (localStorage)')
    if (!electronMode) {
      console.log('⚠️ Browser mode: Conversations are stored in localStorage, not JSON files on disk')
      console.log('To use file storage, run: npm start (which launches Electron)')
    }
    console.log('========================')
  }, [])

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen')
    if (saved !== null) {
      setSidebarOpen(JSON.parse(saved))
    }
  }, [])

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  // Keyboard shortcut: Cmd/Ctrl + B to toggle sidebar (VS Code standard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ErrorProvider>
      <ProviderProvider>
        <ConversationProvider>
          <div className="flex h-screen bg-background overflow-hidden">
            {/* Collapsible Sidebar */}
            <Sidebar
              isOpen={sidebarOpen}
              currentConversation={currentConversation}
              onSelectConversation={setCurrentConversation}
              onOpenSettings={() => setShowSettings(true)}
            />

            {/* Main Chat Area */}
            <ChatWindow
              conversationId={currentConversation}
              onOpenSettings={() => setShowSettings(true)}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            />

            {/* Settings Modal */}
            {showSettings && (
              <SettingsModal onClose={() => setShowSettings(false)} />
            )}
          </div>
        </ConversationProvider>
      </ProviderProvider>
    </ErrorProvider>
  )
}

export default App
