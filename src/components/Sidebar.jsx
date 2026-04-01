import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus as PlusIcon, Settings as SettingsIcon, MessageSquare as MessageSquareIcon, Pencil as PencilIcon, Trash as TrashIcon, MoreVertical as MoreVerticalIcon } from 'lucide-react'
import { useConversation } from '@/contexts/ConversationContext'
import { useProvider } from '@/contexts/ProviderContext'
import { PROVIDERS } from '@/config/providers'

function Sidebar({ isOpen, currentConversation, onSelectConversation, onOpenSettings }) {
  const { conversations, currentConversationId, startNewConversation, selectConversation, updateConversationTitle, deleteConversation } = useConversation()
  const { setProvider, customProviders } = useProvider()


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

  const handleNewConversation = useCallback(async () => {
    await startNewConversation()
  }, [startNewConversation])

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
        border-r flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0
        ${isOpen ? 'w-80 min-w-[320px]' : 'w-16 min-w-[64px]'}
      `}
      style={{ backgroundColor: '#F9F9F9' }}
    >
      {/* New Conversation Button Container */}
      <div className="sidebar-header" style={{ borderBottom: '1px solid transparent' }}>
        <div className={`${isOpen ? 'p-4' : 'p-2'}`}>
          {isOpen ? (
            <Button className="w-full h-11" variant="outline" onClick={handleNewConversation}>
              <PlusIcon className="mr-2 h-5 w-5" />
              <span className="text-base font-medium">New Conversation</span>
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button className="w-full h-11" variant="outline" size="icon" onClick={handleNewConversation}>
                    <PlusIcon className="h-5 w-5" />
                    <span className="sr-only">New Conversation</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">New Conversation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Conversations List Container */}
      <div className="sidebar-content flex-1 overflow-hidden" style={{ borderTop: '1px solid transparent' }}>
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
                    <MessageSquareIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium leading-snug">
                        {conv.title.length > 16 ? conv.title.substring(0, 16) + '...' : conv.title}
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
      <div className="sidebar-footer border-t">
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
