import { useState, useEffect, useRef, useCallback } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PROVIDERS, getFallbackModels, getProviderById } from '@/config/providers'
import { useProvider } from '@/contexts/ProviderContext'
import { useConversation } from '@/contexts/ConversationContext'
import { useModelFetcher, ERROR_TYPES } from '@/hooks/useModelFetcher'
import { useError } from '@/contexts/ErrorContext'
import { sendMessage as sendStreamingMessage } from '@/core/chat/ChatManager'
import { formatMessageForAPI, formatMessagesForAPI } from '@/utils/messageFormatters'
import { isThinkingModel, isImageGenerationModel, getModalitiesForModel } from '@/core/model/ModelUtils'
import { handleStreamingError } from '@/utils/errorHandlers'
import { createStreamingCallbacks } from '@/utils/streamingHelpers'
import { UpdateButton } from './UpdateButton'

// ─── ChatWindow ───────────────────────────────────────────────────────────────

function ChatWindow({ conversationId, onOpenSettings }) {
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

  // Refs track the absolutely latest selections to avoid stale closure bugs
  const latestModelRef = useRef(model)
  const latestProviderRef = useRef(provider)

  useEffect(() => { latestModelRef.current = model }, [model])
  useEffect(() => { latestProviderRef.current = provider }, [provider])

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

  const allProviders = [...PROVIDERS, ...customProviders]

  const providerInfo = getProviderById(provider) || customProviders.find(p => p.id === provider)
  const hasApiKey = Boolean(apiKeys[provider])
  const needsApiKey = providerInfo && providerInfo.supportsDynamicFetch !== false

  const fetchStatus = modelsFetchStatus[provider] || { loading: false, error: null, errorType: null }

  const fetchedModels = getModelsForProvider(provider)
  const fallbackModels = getFallbackModels(provider)

  let currentModels = fetchedModels
  let usingFallback = false

  if (fetchedModels.length === 0) {
    if (fetchStatus.errorType === ERROR_TYPES.NO_API_KEY ||
        fetchStatus.errorType === ERROR_TYPES.INVALID_KEY ||
        (needsApiKey && !hasApiKey)) {
      currentModels = []
    } else if (fetchStatus.errorType === ERROR_TYPES.NETWORK_ERROR ||
               fetchStatus.errorType === ERROR_TYPES.OTHER_ERROR) {
      currentModels = fallbackModels
      usingFallback = true
    } else {
      currentModels = fallbackModels
    }
  }

  // Auto-fetch models when provider changes
  useEffect(() => {
    const autoFetchModels = async () => {
      if (isLoading) return

      if (needsApiKey && !hasApiKey) {
        showMissingApiKeyAlert(
          providerInfo.name,
          () => { if (onOpenSettings) onOpenSettings() }
        )
        return
      }

      if (fetchedModels.length > 0) return

      try {
        await fetchModels(provider, false)
      } catch (error) {
        if (error.message.includes('API key not configured')) {
          showMissingApiKeyAlert(providerInfo.name, () => {
            if (onOpenSettings) onOpenSettings()
          })
        } else if (error.message.includes('401') || error.message.includes('Invalid API key')) {
          showInvalidApiKeyAlert(
            providerInfo.name,
            error.message,
            () => { if (onOpenSettings) onOpenSettings() }
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
  }, [provider, hasApiKey, isLoading])

  const getModelsForCurrentProvider = (providerId = null) => {
    const targetProvider = providerId || provider
    const fetched = getModelsForProvider(targetProvider)
    return fetched.length > 0 ? fetched : getFallbackModels(targetProvider)
  }

  const getModalitiesForCurrentModel = (modelId, providerId = null) => {
    return getModalitiesForModel(modelId, getModelsForCurrentProvider(providerId))
  }

  const isModelThinking = (modelId, providerId = null) => {
    return isThinkingModel(modelId, getModelsForCurrentProvider(providerId))
  }

  // Restore conversation's last used model when switching conversations
  useEffect(() => {
    if (isLoading) return
    if (isConversationStreaming(currentConversationId)) return

    const conversation = getCurrentConversation()
    if (!conversation) return

    const savedModel = conversation.model
    if (!savedModel) return

    const providerModels = getModelsForProvider(provider)
    const providerFallbackModels = getFallbackModels(provider)
    const allModelsForProvider = [...providerModels, ...providerFallbackModels]

    const modelExists = allModelsForProvider.some(m => m.id === savedModel)
    if (modelExists && model !== savedModel) {
      setModel(savedModel)
    }
  }, [currentConversationId, isLoading])

  const handleRefreshModels = useCallback(async () => {
    if (needsApiKey && !hasApiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    try {
      const models = await fetchModels(provider, true)
      if (models.length > 0 && !models.find(m => m.id === model)) {
        setModel(models[0].id)
      }
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Invalid API key')) {
        showInvalidApiKeyAlert(
          providerInfo.name,
          error.message,
          () => { if (onOpenSettings) onOpenSettings() }
        )
      } else {
        showFetchErrorAlert(
          providerInfo.name,
          error.message,
          () => handleRefreshModels()
        )
      }
    }
  }, [provider, model, hasApiKey, needsApiKey, providerInfo, fetchModels, setModel,
      showMissingApiKeyAlert, showInvalidApiKeyAlert, showFetchErrorAlert, onOpenSettings])

  const handleProviderChange = useCallback((value) => {
    latestProviderRef.current = value
    setProvider(value)
    const cached = getModelsForProvider(value)
    const fallback = getFallbackModels(value)
    const models = cached.length > 0 ? cached : fallback
    if (models.length > 0) {
      latestModelRef.current = models[0].id
      setModel(models[0].id)
    }
  }, [setProvider, setModel, getModelsForProvider])

  const handleModelChange = useCallback((value) => {
    latestModelRef.current = value
    setModel(value)
  }, [setModel])

  const handleSendMessage = async (messageContent, attachments = []) => {
    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    const apiKey = apiKeys[currentProvider]
    if (!apiKey) {
      const providerName = getProviderById(currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name
      showMissingApiKeyAlert(providerName, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    const targetConversationId = currentConversationId

    if (isConversationStreaming(targetConversationId)) return

    try {
      await addMessage({
        role: 'user',
        content: messageContent,
        model: currentModel,
        provider: currentProvider,
        attachments: attachments.length > 0 ? attachments : undefined
      }, targetConversationId)

      await addMessage({
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

    const currentUserMessage = await formatMessageForAPI(
      { role: 'user', content: messageContent },
      attachments
    )

    const messagesForApi = [
      ...(await formatMessagesForAPI(messages)),
      currentUserMessage
    ]

    const abortSignal = startStreaming(targetConversationId)

    const sendMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

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
    if (isConversationStreaming(currentConversationId)) {
      stopStreaming(currentConversationId)
    }
  }

  const handleRetry = async (assistantMessage) => {
    if (isConversationStreaming(currentConversationId)) return

    const messageIndex = messages.findIndex(m => m.id === assistantMessage.id)
    if (messageIndex <= 0) return

    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    const apiKey = apiKeys[provider]
    if (!apiKey) {
      showMissingApiKeyAlert(providerInfo.name, () => {
        if (onOpenSettings) onOpenSettings()
      })
      return
    }

    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    const messagesForApi = formatMessagesForAPI(messages.slice(0, messageIndex))

    const clearMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider,
      reasoning: '',
      isReasoningComplete: false
    }
    updateLastMessage('', false, clearMetadata)

    const retryConversationId = currentConversationId
    const abortSignal = startStreaming(retryConversationId)

    const streamingMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

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
      await sendStreamingMessage({
        providerId: currentProvider,
        providerConfig: customProviders.find(p => p.id === currentProvider),
        apiKey: apiKeys[currentProvider],
        model: currentModel,
        messages: messagesForApi,
        ...streamingCallbacks,
        abortSignal,
        modalities: getModalitiesForCurrentModel(currentModel, currentProvider),
        reasoning: isModelThinking(currentModel, currentProvider) ? { effort: 'high' } : null
      })
    } catch (error) {
      console.error('Unexpected retry error:', error)
      stopStreaming(retryConversationId)
    }
  }

  const handleEditUserMessage = async (userMessage, newContent) => {
    if (isConversationStreaming(currentConversationId)) return

    const editConversationId = currentConversationId
    const currentModel = latestModelRef.current
    const currentProvider = latestProviderRef.current

    const messageIndex = messages.findIndex(m => m.id === userMessage.id)
    if (messageIndex < 0) return

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
      const updatedMessages = [...messages]
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content: newContent,
        timestamp: new Date().toISOString()
      }

      const messagesUpToEdit = updatedMessages.slice(0, messageIndex + 1)
      await replaceMessages(messagesUpToEdit)
      messagesForApi = formatMessagesForAPI(messagesUpToEdit)

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

    const abortSignal = startStreaming(editConversationId)

    const editMetadata = {
      timestamp: new Date().toISOString(),
      model: currentModel,
      provider: currentProvider
    }

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
          providerName,
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
      console.error('Unexpected edit error:', error)
      stopStreaming(editConversationId)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-8" />
            <p className="text-sm text-muted-foreground">Loading configuration...</p>
          </div>
        </div>
        <div className="border-t p-4">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
      <MessageList
        messages={messages}
        onRetry={handleRetry}
        onEditUserMessage={handleEditUserMessage}
        onDeleteMessage={deleteMessage}
        isStreaming={isConversationStreaming(currentConversationId)}
      />
      <MessageInput
        onSendMessage={handleSendMessage}
        isStreaming={isConversationStreaming(currentConversationId)}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  )
}

export default ChatWindow
