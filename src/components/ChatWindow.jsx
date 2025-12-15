import { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SearchableSelect } from './SearchableSelect'
import { PROVIDERS, getAllModels, getFallbackModels, getProviderById } from '@/config/providers'
import { useProvider } from '@/contexts/ProviderContext'
import { useConversation } from '@/contexts/ConversationContext'
import { useModelFetcher, ERROR_TYPES } from '@/hooks/useModelFetcher'
import { useError } from '@/contexts/ErrorContext'
import { sendStreamingMessage } from '@/services/chat/chatClient'
import { RefreshCw as RefreshCwIcon, AlertTriangle as AlertTriangleIcon, WifiOff as WifiOffIcon, Key as KeyIcon, PanelLeftClose as ChevronsLeftIcon, PanelLeftOpen as ChevronsRightIcon } from 'lucide-react'
import { formatMessageForAPI, formatMessagesForAPI } from '@/utils/messageFormatters'
import { isThinkingModel, isImageGenerationModel, getModalitiesForModel } from '@/utils/modelHelpers'
import { handleStreamingError } from '@/utils/errorHandlers'
import { createStreamingCallbacks } from '@/utils/streamingHelpers'

function ChatWindow({ conversationId, onOpenSettings, sidebarOpen, onToggleSidebar }) {
  const {
    provider,
    setProvider,
    model,
    setModel,
    getModelsForProvider,
    modelsFetchStatus,
    apiKeys,
    customProviders,
    isLoading
  } = useProvider()

  // Use refs to track the absolutely latest model/provider selections
  // This solves the issue where React state updates are async and retry
  // might read stale values if user changes model and immediately clicks retry
  const latestModelRef = useRef(model)
  const latestProviderRef = useRef(provider)

  // Keep refs in sync with state
  useEffect(() => {
    latestModelRef.current = model
  }, [model])

  useEffect(() => {
    latestProviderRef.current = provider
  }, [provider])
  const {
    messages,
    isConversationStreaming,
    startStreaming,
    stopStreaming,
    addMessage,
    updateLastMessage,
    updateLastMessageReasoning,
    markReasoningComplete,
    replaceMessages,
    deleteMessage,
    currentConversationId,
    getCurrentConversation,
    getConversationById
  } = useConversation()
  const { fetchModels } = useModelFetcher()
  const { showMissingApiKeyAlert, showFetchErrorAlert, showInvalidApiKeyAlert } = useError()

  // Combine built-in and custom providers
  const allProviders = [...PROVIDERS, ...customProviders]

  // Get provider info
  const providerInfo = getProviderById(provider) || customProviders.find(p => p.id === provider)
  const hasApiKey = Boolean(apiKeys[provider])
  const needsApiKey = providerInfo && providerInfo.supportsDynamicFetch !== false

  const fetchStatus = modelsFetchStatus[provider] || { loading: false, error: null, errorType: null }

  // Get models - conditionally based on error type
  const fetchedModels = getModelsForProvider(provider)
  const fallbackModels = getFallbackModels(provider)

  // Determine which models to show based on error type
  let currentModels = fetchedModels
  let usingFallback = false

  if (fetchedModels.length === 0) {
    // If no API key configured or invalid key, show empty array (no models)
    if (fetchStatus.errorType === ERROR_TYPES.NO_API_KEY ||
        fetchStatus.errorType === ERROR_TYPES.INVALID_KEY ||
        (needsApiKey && !hasApiKey)) {
      currentModels = []
    }
    // For network errors or other errors, show fallback models
    else if (fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR ||
             fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR) {
      currentModels = fallbackModels
      usingFallback = true
    }
    // No error yet, use fallback as default
    else {
      currentModels = fallbackModels
    }
  }

  // Auto-fetch models when provider changes
  useEffect(() => {
    const autoFetchModels = async () => {
      // Wait for initial data to load before showing alerts
      if (isLoading) return

      // Check if provider needs API key
      if (needsApiKey && !hasApiKey) {
        // Show alert for missing API key
        showMissingApiKeyAlert(
          providerInfo.name,
          () => {
            if (onOpenSettings) {
              onOpenSettings()
            }
          }
        )
        return
      }

      // Don't auto-fetch if we already have models
      if (fetchedModels.length > 0) return

      try {
        await fetchModels(provider, false)
      } catch (error) {
        // Categorize error and show appropriate alert
        if (error.message.includes('API key not configured')) {
          showMissingApiKeyAlert(providerInfo.name, () => {
            if (onOpenSettings) onOpenSettings()
          })
        } else if (error.message.includes('401') || error.message.includes('Invalid API key')) {
          showInvalidApiKeyAlert(
            providerInfo.name,
            error.message,
            () => {
              if (onOpenSettings) onOpenSettings()
            }
          )
        } else {
          showFetchErrorAlert(
            providerInfo.name,
            error.message,
            () => handleRefreshModels()
          )
        }
      }
    }

    autoFetchModels()
  }, [provider, hasApiKey, isLoading]) // Run when provider, API key, or loading state changes

  // Get modalities for a model (wrapper for the utility function with currentModels)
  const getModalitiesForCurrentModel = (modelId, providerId = null) => {
    // Use provided providerId or fall back to current provider
    const targetProvider = providerId || provider
    const fetchedModels = getModelsForProvider(targetProvider)
    const fallbackModels = getFallbackModels(targetProvider)
    const models = fetchedModels.length > 0 ? fetchedModels : fallbackModels
    return getModalitiesForModel(modelId, models)
  }

  const isModelThinking = (modelId, providerId = null) => {
    // Use provided providerId or fall back to current provider
    const targetProvider = providerId || provider
    const fetchedModels = getModelsForProvider(targetProvider)
    const fallbackModels = getFallbackModels(targetProvider)
    const models = fetchedModels.length > 0 ? fetchedModels : fallbackModels

    return isThinkingModel(modelId, models)
  }

  // Restore conversation's last used model when switching conversations
  // Note: Provider restoration is handled by Sidebar.handleSelectConversation
  useEffect(() => {
    if (isLoading) return

    // Don't restore model while streaming - user might have manually changed it
    if (isConversationStreaming(currentConversationId)) return

    const conversation = getCurrentConversation()
    if (!conversation) return

    // Check if conversation has saved model
    const savedModel = conversation.model
    if (!savedModel) return

    // Get models for the current provider
    const providerModels = getModelsForProvider(provider)
    const providerFallbackModels = getFallbackModels(provider)
    const allModelsForProvider = [...providerModels, ...providerFallbackModels]

    // Check if saved model exists in current provider's models and restore it
    const modelExists = allModelsForProvider.some(m => m.id === savedModel)
    if (modelExists && model !== savedModel) {
      setModel(savedModel)
    }
  }, [currentConversationId, isLoading]) // Only run when switching conversations, not when user changes provider manually

  const handleRefreshModels = async () => {
    if (needsApiKey && !hasApiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    try {
      const models = await fetchModels(provider, true) // Force refresh
      // Auto-select first model if current model is not in the list
      if (models.length > 0 && !models.find(m => m.id === model)) {
        setModel(models[0].id)
      }
    } catch (error) {
      // Show appropriate error alert
      if (error.message.includes('401') || error.message.includes('Invalid API key')) {
        showInvalidApiKeyAlert(
          providerInfo.name,
          error.message,
          () => {
            if (onOpenSettings) onOpenSettings()
          }
        )
      } else {
        showFetchErrorAlert(
          providerInfo.name,
          error.message,
          () => handleRefreshModels()
        )
      }
    }
  }

  const handleSendMessage = async (messageContent, attachments = []) => {
    // Use refs to get the absolutely latest model/provider selection
    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    // Check if we have an API key
    const apiKey = apiKeys[currentProvider]
    if (!apiKey) {
      const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
      showMissingApiKeyAlert(providerName, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    // Capture conversation ID at the very start (before any async operations)
    const targetConversationId = currentConversationId

    // Don't allow sending if this conversation is already streaming
    if (isConversationStreaming(targetConversationId)) {
      return
    }

    try {
      // Add user message with attachments to the captured conversation
      await addMessage({
        role: 'user',
        content: messageContent,
        model: currentModel,
        provider: currentProvider,
        attachments: attachments.length > 0 ? attachments : undefined
      }, targetConversationId)

      // Create placeholder for assistant message in the same conversation
      const assistantMessage = await addMessage({
        role: 'assistant',
        content: '',
        model: currentModel,
        provider: currentProvider
      }, targetConversationId)
    } catch (error) {
      console.error('Error adding messages:', error)
      const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
      showFetchErrorAlert(providerName, 'Failed to save message. Please try again.')
      return
    }

    // Build messages array for API call (since state may not be updated yet)
    // Format current message with attachments for multimodal API
    const currentUserMessage = formatMessageForAPI(
      { role: 'user', content: messageContent },
      attachments
    )

    // Format message history with attachments support
    const messagesForApi = [
      ...formatMessagesForAPI(messages),
      currentUserMessage
    ]

    // Start streaming for this conversation
    const abortSignal = startStreaming(targetConversationId)

    // Create metadata for the response
    const sendMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: targetConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
      metadata: sendMetadata,
      onError: (error) => {
        handleStreamingError({
          error,
          providerName: providerInfo.name,
          errorHandlers: { showFetchErrorAlert, showInvalidApiKeyAlert, showMissingApiKeyAlert },
          onOpenSettings
        })
      }
    })

    try {
      await sendStreamingMessage({
        providerId: currentProvider,
        providerConfig: customProviders.find(p => p.id === currentProvider),
        apiKey,
        model: currentModel,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities: getModalitiesForCurrentModel(currentModel, currentProvider),
        reasoning: isModelThinking(currentModel, currentProvider) ? { effort: 'high' } : null
      })
    } catch (error) {
      console.error('Unexpected error:', error)
      stopStreaming(targetConversationId)
    }
  }

  const handleStopGeneration = () => {
    // Stop streaming only for the current conversation
    if (isConversationStreaming(currentConversationId)) {
      stopStreaming(currentConversationId)
    }
  }

  const handleRetry = async (assistantMessage) => {
    if (isConversationStreaming(currentConversationId)) return

    // Find the user message that triggered this assistant response
    const messageIndex = messages.findIndex(m => m.id === assistantMessage.id)
    if (messageIndex <= 0) return

    // Get the user message before the assistant message
    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    // Check if we have an API key
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    // Use refs to get the absolutely latest model/provider selection
    // This ensures we use the user's current selection even if React state hasn't updated yet
    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    // Build messages for API call (all messages up to but not including this assistant response)
    // Use formatMessagesForAPI to properly handle attachments
    const messagesForApi = formatMessagesForAPI(messages.slice(0, messageIndex))

    // Clear the assistant message content for regeneration
    // First, clear with full metadata including reasoning reset
    const clearMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider,
      reasoning: '',
      isReasoningComplete: false
    }
    updateLastMessage('', false, clearMetadata)

    // Capture conversation ID at start of streaming
    const retryConversationId = currentConversationId

    // Start streaming
    const abortSignal = startStreaming(retryConversationId)

    // Create metadata for streaming updates (without reasoning fields to avoid overwrites)
    const streamingMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: retryConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
      metadata: streamingMetadata,
      onError: (error) => {
        handleStreamingError({
          error,
          providerName: providerInfo.name,
          errorHandlers: { showFetchErrorAlert, showInvalidApiKeyAlert, showMissingApiKeyAlert },
          onOpenSettings
        })
      }
    })

    try {
      const modalities = getModalitiesForCurrentModel(currentModel, currentProvider)
      const reasoning = isModelThinking(currentModel, currentProvider) ? { effort: 'high' } : null

      await sendStreamingMessage({
        providerId: currentProvider,
        providerConfig: customProviders.find(p => p.id === currentProvider),
        apiKey: apiKeys[currentProvider],
        model: currentModel,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities,
        reasoning
      })
    } catch (error) {
      console.error('Unexpected retry error:', error)
      stopStreaming(retryConversationId)
    }
  }

  const handleEditUserMessage = async (userMessage, newContent) => {
    if (isConversationStreaming(currentConversationId)) return

    // Capture conversation ID at the very start (before any async operations)
    const editConversationId = currentConversationId

    // Use refs to get the absolutely latest model/provider selection
    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    // Find the index of the user message
    const messageIndex = messages.findIndex(m => m.id === userMessage.id)
    if (messageIndex < 0) return

    // Check if we have an API key
    const apiKey = apiKeys[currentProvider]
    if (!apiKey) {
      const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
      showMissingApiKeyAlert(providerName, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    let messagesForApi
    try {
      // Update the user message content in state
      const updatedMessages = [...messages]
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: newContent,
        timestamp: new Date().toISOString()
      }

      // Remove all messages after this user message (assistant response and any following)
      const messagesUpToEdit = updatedMessages.slice(0, messageIndex + 1)

      // Update state and storage immediately
      await replaceMessages(messagesUpToEdit)

      // Build messages for API call - use formatMessagesForAPI to properly handle attachments
      messagesForApi = formatMessagesForAPI(messagesUpToEdit)

      // Add new assistant placeholder to the captured conversation
      await addMessage({
        role: 'assistant',
        content: '',
        reasoning: '',
        isReasoningComplete: false,
        model: currentModel,
        provider: currentProvider
      }, editConversationId)
    } catch (error) {
      console.error('Error editing message:', error)
      const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
      showFetchErrorAlert(providerName, 'Failed to edit message. Please try again.')
      return
    }

    // Start streaming the new response
    const abortSignal = startStreaming(editConversationId)

    // Create metadata for the new response
    const editMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: editConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
      metadata: editMetadata,
      onError: (error) => {
        const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
        handleStreamingError({
          error,
          providerName: providerName,
          errorHandlers: { showFetchErrorAlert, showInvalidApiKeyAlert, showMissingApiKeyAlert },
          onOpenSettings
        })
      }
    })

    try {
      const modalities = getModalitiesForCurrentModel(currentModel, currentProvider)
      const reasoning = isModelThinking(currentModel, currentProvider) ? { effort: 'high' } : null

      await sendStreamingMessage({
        providerId: currentProvider,
        providerConfig: customProviders.find(p => p.id === currentProvider),
        apiKey,
        model: currentModel,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities,
        reasoning
      })
    } catch (error) {
      console.error('Unexpected edit error:', error)
      stopStreaming(editConversationId)
    }
  }

  // Show loading state while initial data loads
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header skeleton */}
        <div className="border-b px-4 py-3">
          <div className="border rounded-lg p-2 flex items-center gap-2 w-fit">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-5 w-1" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Messages area with centered spinner */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-8" />
            <p className="text-sm text-muted-foreground">Loading configuration...</p>
          </div>
        </div>

        {/* Input skeleton */}
        <div className="border-t p-4">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header with Provider/Model Selection */}
      <div className="border-b px-6 py-4 bg-muted/10">
        <div className="flex items-center gap-6">
          {/* Sidebar Toggle Button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidebar}
                  className="h-16 w-16 flex-shrink-0"
                >
                  {sidebarOpen ? (
                    <ChevronsLeftIcon size={28} />
                  ) : (
                    <ChevronsRightIcon size={28} />
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

          {/* Provider/Model Selection Container */}
          <div className="border rounded-xl p-3 flex items-center gap-3 w-fit shadow-sm bg-background">
          <Badge variant="secondary" className="text-sm px-3 py-1 bg-muted text-foreground hover:bg-muted pointer-events-none">Provider</Badge>
          <SearchableSelect
            value={provider}
            onValueChange={(value) => {
              // Update ref IMMEDIATELY (synchronously) before state updates
              latestProviderRef.current = value
              setProvider(value)
              // Auto-select first model when cached models load
              const cached = getModelsForProvider(value)
              const fallback = getFallbackModels(value)
              const models = cached.length > 0 ? cached : fallback
              if (models.length > 0) {
                latestModelRef.current = models[0].id
                setModel(models[0].id)
              }
            }}
            options={allProviders}
            placeholder="Select provider..."
            searchPlaceholder="Search providers..."
            showDescription={true}
            className="h-10 text-base"
          />

          <Separator orientation="vertical" className="h-6" />

          <Badge variant="secondary" className="text-sm px-3 py-1 bg-muted text-foreground hover:bg-muted pointer-events-none">Model</Badge>
          <SearchableSelect
            value={model}
            onValueChange={(value) => {
              // Update ref IMMEDIATELY (synchronously) before state updates
              latestModelRef.current = value
              setModel(value)
            }}
            options={currentModels}
            placeholder={
              fetchStatus.loading
                ? 'Loading models...'
                : fetchStatus.errorType === ERROR_TYPES.NO_API_KEY
                ? 'Configure API key first'
                : fetchStatus.errorType === ERROR_TYPES.INVALID_KEY
                ? 'Invalid API key'
                : fetchStatus.error
                ? 'Error loading models'
                : currentModels.length === 0
                ? 'No models available'
                : 'Select model...'
            }
            searchPlaceholder="Search models..."
            showDescription={true}
            className="h-10 min-w-[240px] text-base"
            loading={fetchStatus.loading}
            error={fetchStatus.error}
          />

          {/* Context-aware warning badges */}
          {fetchStatus.errorType === ERROR_TYPES.NO_API_KEY && (
            <Badge variant="outline" className="text-red-600 border-red-600 h-10 px-3 text-sm">
              <KeyIcon className="h-4 w-4 mr-2" />
              API Key Required
            </Badge>
          )}
          {fetchStatus.errorType === ERROR_TYPES.INVALID_KEY && (
            <Badge variant="outline" className="text-red-600 border-red-600 h-10 px-3 text-sm">
              <AlertTriangleIcon className="h-4 w-4 mr-2" />
              Invalid API Key
            </Badge>
          )}
          {fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR && usingFallback && (
            <Badge variant="outline" className="text-blue-600 border-blue-600 h-10 px-3 text-sm">
              <WifiOffIcon className="h-4 w-4 mr-2" />
              Network Error - Using Fallback
            </Badge>
          )}
          {fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR && usingFallback && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 h-10 px-3 text-sm">
              <AlertTriangleIcon className="h-4 w-4 mr-2" />
              Using Fallback Models
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={handleRefreshModels}
            disabled={fetchStatus.loading}
            title="Refresh models"
          >
            <RefreshCwIcon className={`h-5 w-5 ${fetchStatus.loading ? 'animate-spin' : ''}`} />
          </Button>
          </div>
        </div>
      </div>

      <MessageList messages={messages} onRetry={handleRetry} onEditUserMessage={handleEditUserMessage} onDeleteMessage={deleteMessage} isStreaming={isConversationStreaming(currentConversationId)} />
      <MessageInput
        onSendMessage={handleSendMessage}
        isStreaming={isConversationStreaming(currentConversationId)}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  )
}

export default ChatWindow
