import { useState, useEffect } from 'react'
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
  const getModalitiesForCurrentModel = (modelId) => {
    return getModalitiesForModel(modelId, currentModels)
  }

  // Restore conversation's last used provider/model when switching conversations
  useEffect(() => {
    if (isLoading) return // Wait for initial data to load

    const conversation = getCurrentConversation()
    if (!conversation) return

    // Check if conversation has saved provider and model
    const savedProvider = conversation.provider
    const savedModel = conversation.model

    if (!savedProvider || !savedModel) return // No saved provider/model

    // Validate provider still exists
    const providerExists = allProviders.some(p => p.id === savedProvider)
    if (!providerExists) return // Provider no longer exists

    // Get models for the saved provider
    const providerModels = getModelsForProvider(savedProvider)
    const providerFallbackModels = getFallbackModels(savedProvider)
    const allModelsForProvider = [...providerModels, ...providerFallbackModels]

    // Check if saved model still exists in provider's models
    const modelExists = allModelsForProvider.some(m => m.id === savedModel)

    if (providerExists && modelExists) {
      // Both provider and model are valid, restore them
      if (provider !== savedProvider) {
        setProvider(savedProvider)
      }
      if (model !== savedModel) {
        setModel(savedModel)
      }
    } else if (providerExists) {
      // Provider exists but model doesn't, just restore provider
      if (provider !== savedProvider) {
        setProvider(savedProvider)
      }
    }
  }, [currentConversationId, isLoading]) // Run when conversation changes

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
    // Check if we have an API key
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
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
        model,
        provider,
        attachments: attachments.length > 0 ? attachments : undefined
      }, targetConversationId)

      // Create placeholder for assistant message in the same conversation
      const assistantMessage = await addMessage({
        role: 'assistant',
        content: '',
        model,
        provider
      }, targetConversationId)
    } catch (error) {
      console.error('Error adding messages:', error)
      showFetchErrorAlert(providerInfo.name, 'Failed to save message. Please try again.')
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

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: targetConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
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
        providerId: provider,
        providerConfig: customProviders.find(p => p.id === provider),
        apiKey,
        model,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities: getModalitiesForCurrentModel(model),
        reasoning: isThinkingModel(model) ? { effort: 'high' } : null
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

    // Build messages for API call (all messages up to but not including this assistant response)
    // Use formatMessagesForAPI to properly handle attachments
    const messagesForApi = formatMessagesForAPI(messages.slice(0, messageIndex))

    // Clear the assistant message content for regeneration and update metadata
    const newMetadata = {
      timestamp: new Date().toISOString(),
      model,
      provider,
      reasoning: '',
      isReasoningComplete: false
    }
    updateLastMessage('', false, newMetadata)

    // Capture conversation ID at start of streaming
    const retryConversationId = currentConversationId

    // Start streaming
    const abortSignal = startStreaming(retryConversationId)

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: retryConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
      metadata: newMetadata,
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
        providerId: provider,
        providerConfig: customProviders.find(p => p.id === provider),
        apiKey,
        model,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities: getModalitiesForCurrentModel(model),
        reasoning: isThinkingModel(model) ? { effort: 'high' } : null
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

    // Find the index of the user message
    const messageIndex = messages.findIndex(m => m.id === userMessage.id)
    if (messageIndex < 0) return

    // Check if we have an API key
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
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
        model,
        provider
      }, editConversationId)
    } catch (error) {
      console.error('Error editing message:', error)
      showFetchErrorAlert(providerInfo.name, 'Failed to edit message. Please try again.')
      return
    }

    // Start streaming the new response
    const abortSignal = startStreaming(editConversationId)

    // Create streaming callbacks using utility
    const streamingCallbacks = createStreamingCallbacks({
      conversationId: editConversationId,
      updateLastMessage,
      updateLastMessageReasoning,
      markReasoningComplete,
      getConversationById,
      stopStreaming,
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
        providerId: provider,
        providerConfig: customProviders.find(p => p.id === provider),
        apiKey,
        model,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities: getModalitiesForCurrentModel(model),
        reasoning: isThinkingModel(model) ? { effort: 'high' } : null
      })
    } catch (error) {
      console.error('Unexpected edit error:', error)
      stopStreaming(editConversationId)
    }
  }

  // Show loading state while initial data loads
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full">
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
    <div className="flex-1 flex flex-col h-full">
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
          <Badge variant="secondary" className="text-sm px-3 py-1">Provider</Badge>
          <SearchableSelect
            value={provider}
            onValueChange={(value) => {
              setProvider(value)
              // Auto-select first model when cached models load
              const cached = getModelsForProvider(value)
              const fallback = getFallbackModels(value)
              const models = cached.length > 0 ? cached : fallback
              if (models.length > 0) {
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

          <Badge variant="secondary" className="text-sm px-3 py-1">Model</Badge>
          <SearchableSelect
            value={model}
            onValueChange={setModel}
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
