import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus as PlusIcon, Settings as SettingsIcon, MessageSquare as MessageSquareIcon, Pencil as PencilIcon, Trash as TrashIcon, MoreVertical as MoreVerticalIcon, PanelLeftClose as ChevronsLeftIcon, PanelLeftOpen as ChevronsRightIcon } from 'lucide-react'
import { useConversation } from '@/contexts/ConversationContext'
import { useProvider } from '@/contexts/ProviderContext'
import { PROVIDERS } from '@/config/providers'

function Sidebar({ isOpen, onSelectConversation, onOpenSettings, sidebarOpen, onToggleSidebar }) {
  const { conversations, currentConversationId, startNewConversation, selectConversation, updateConversationTitle, deleteConversation } = useConversation()
  const { setProvider, customProviders, provider } = useProvider()


  const [editingConv, setEditingConv] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingConv, setDeletingConv] = useState(null)
  const conversationRefsMap = useRef(new Map())
  const scrollAreaRef = useRef(null)
  const wasSidebarClosedRef = useRef(true)

  // Set conversation element ref with automatic cleanup
  const setConversationRef = useCallback((convId, el) => {
    el ? conversationRefsMap.current.set(convId, el) : conversationRefsMap.current.delete(convId)
  }, [])

  // Scroll to current conversation when sidebar opens
  useEffect(() => {
    if (!isOpen || !currentConversationId) return

    const scrollArea = scrollAreaRef.current
    const viewport = scrollArea?.querySelector('[data-radix-scroll-area-viewport]')
    const convElement = conversationRefsMap.current.get(currentConversationId)
    if (!viewport || !convElement) return

    const viewportRect = viewport.getBoundingClientRect()
    const elementRect = convElement.getBoundingClientRect()
    const targetScrollTop = viewport.scrollTop + elementRect.top - viewportRect.top - (viewportRect.height - elementRect.height) / 2

    viewport.scrollTo({ top: targetScrollTop, behavior: wasSidebarClosedRef.current ? 'instant' : 'smooth' })
    wasSidebarClosedRef.current = false
  }, [isOpen, currentConversationId])

  // Mark sidebar as closed when it closes
  useEffect(() => {
    if (!isOpen) wasSidebarClosedRef.current = true
  }, [isOpen])

  // Clean up refs when conversations list changes
  useEffect(() => {
    const activeIds = new Set(conversations.map(c => c.id))
    conversationRefsMap.current.forEach((_, id) => !activeIds.has(id) && conversationRefsMap.current.delete(id))
  }, [conversations])

  // Format timestamp for display
  const formatTimestamp = (isoString) => {
    const date = new Date(isoString)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`

    const sameYear = date.getFullYear() === now.getFullYear()
    return sameYear
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleSelectConversation = useCallback((conversationID) => {
    const conversation = conversations.find(c => c.id === conversationID)
    if (!conversation) return

    if (conversation.provider) {
      const allProviders = [...PROVIDERS, ...customProviders]
      const providerExists = allProviders.some(p => p.id === conversation.provider)
      setProvider(providerExists ? conversation.provider : PROVIDERS[0].id)
    }

    selectConversation(conversationID)
    onSelectConversation?.(conversationID)
  }, [conversations, customProviders, setProvider, selectConversation, onSelectConversation])

  const handleEditClick = useCallback((conv) => {
    setEditingConv(conv)
    setEditTitle(conv.title)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingConv?.id || !editTitle.trim()) return
    await updateConversationTitle(editingConv.id, editTitle.trim())
    setEditingConv(null)
    setEditTitle('')
  }, [editingConv, editTitle, updateConversationTitle])

  const handleCancelEdit = useCallback(() => {
    setEditingConv(null)
    setEditTitle('')
  }, [])

  const handleDeleteClick = useCallback((conv) => {
    setDeletingConv(conv)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingConv?.id) return
    try {
      await deleteConversation(deletingConv.id)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    } finally {
      setDeletingConv(null)
    }
  }, [deletingConv, deleteConversation])

  const handleCancelDelete = useCallback(() => {
    setDeletingConv(null)
  }, [])

  return (
    <div
      className={`
        flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0 rounded-l-lg
        ${isOpen ? 'w-80 shadow-lg' : 'w-16'}
      `}
      style={{ backgroundColor: '#F9F9F9' }}
    >
      {/* Sidebar Toggle and New Conversation Container */}
      <div className={`sidebar-header flex flex-col items-center p-2 gap-2 ${isOpen ? '' : 'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] rounded-b-lg'}`}>
        <div className={`w-full flex items-center justify-between ${isOpen ? 'px-1' : ''}`}>
          {isOpen && provider && (
            <span className="text-4xl font-semibold text-muted-foreground truncate flex-1 mb-2">
              {PROVIDERS.find(p => p.id === provider)?.name || customProviders.find(p => p.id === provider)?.name || provider}
            </span>
          )}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidebar}
                  className="h-11 w-12 flex-shrink-0"
                >
                  {sidebarOpen ? (
                    <ChevronsLeftIcon className="h-8 w-8" />
                  ) : (
                    <ChevronsRightIcon className="h-8 w-8" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="font-medium">
                <p className="text-sm">
                  {sidebarOpen ? 'Collapse' : 'Expand'} sidebar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <kbd className="inline-flex h-4 select-none items-center gap-1 rounded border bg-muted px-1 font-mono text-[10px] font-medium">
                    {navigator.platform.includes('Mac') ? '⌘B' : 'Ctrl+B'}
                  </kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {!isOpen && <Separator orientation="horizontal" className="w-full" />}
        <div className={`w-full ${isOpen ? 'mt-4 mb-1' : ''}`}>
          {isOpen ? (
            <Button className="w-full h-11 justify-start" variant="ghost" onClick={startNewConversation}>
              <PlusIcon className="mr-2 h-5 w-5" />
              <span className="text-base font-medium">New Conversation</span>
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button className="w-full h-11" variant="outline" size="icon" onClick={startNewConversation}>
                    <PlusIcon className="h-5 w-5" />
                    <span className="sr-only">New Conversation</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium text-sm">New Conversation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Conversations List Container */}
      <div className="sidebar-content flex-1 overflow-hidden">
        {isOpen && (
          <ScrollArea ref={scrollAreaRef} className="h-full px-3">
            <div className="space-y-2 py-2">
              {conversations.map((conv) => (
                <div key={conv.id} className="group w-full">
                  <div
                    onClick={() => handleSelectConversation(conv.id)}
                    ref={(el) => setConversationRef(conv.id, el)}
                    className={`
                      flex items-center gap-3 w-full rounded-md py-4 pl-4 pr-2
                      cursor-pointer transition-colors
                      ${currentConversationId === conv.id
                        ? 'bg-accent text-secondary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'}
                    `}
                    >
                      <div className="flex-1 min-w-0">
                      <p className="text-base font-medium leading-snug truncate">
                        {conv.title.length > 19 ? conv.title.substring(0, 19) + '...' : conv.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{formatTimestamp(conv.updatedAt)}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVerticalIcon className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditClick(conv)
                            }}
                          >
                            <PencilIcon className="h-4 w-4 mr-3" />
                            <span className="text-sm">Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(conv)
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <TrashIcon className="h-4 w-4 mr-3" />
                            <span className="text-sm">Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Settings Button Container */}
      <div className={`sidebar-footer ${isOpen ? 'border-t' : ''}`}>
        <div className={`${isOpen ? 'p-4' : 'p-2'}`}>
        {isOpen ? (
          <Button
            variant="ghost"
            className="w-full justify-start h-11"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="mr-2 h-5 w-5" />
            <span className="text-base">Settings</span>
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full h-11"
                  size="icon"
                  onClick={onOpenSettings}
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      </div>

      {/* Edit Title Dialog */}
      <Dialog open={!!editingConv} onOpenChange={handleCancelEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Conversation Title</DialogTitle>
            <DialogDescription>
              Change the title of this conversation to make it easier to find.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Enter conversation title..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEdit()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingConv} onOpenChange={handleCancelDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingConv?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Sidebar
