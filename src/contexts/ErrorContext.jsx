import { createContext, useContext, useState, useCallback } from 'react'
import { AlertDialog } from '@/components/AlertDialog'

const ErrorContext = createContext(null)

export function ErrorProvider({ children }) {
  const [alert, setAlert] = useState(null)
  const [alertQueue, setAlertQueue] = useState([])

  /**
   * Show an alert dialog
   * @param {object} alertConfig - Alert configuration
   */
  const showAlert = useCallback((alertConfig) => {
    if (alert) {
      // If an alert is already showing, queue this one
      setAlertQueue(prev => [...prev, alertConfig])
    } else {
      setAlert(alertConfig)
    }
  }, [alert])

  /**
   * Close current alert and show next in queue
   */
  const closeAlert = useCallback(() => {
    setAlert(null)

    // Show next alert in queue if any
    setAlertQueue(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev
        setAlert(next)
        return rest
      }
      return prev
    })
  }, [])

  /**
   * Show error alert
   */
  const showError = useCallback((title, message, details = null, actions = {}) => {
    showAlert({
      type: 'error',
      title,
      message,
      details,
      primaryAction: actions.primaryAction,
      secondaryAction: actions.secondaryAction
    })
  }, [showAlert])

  /**
   * Show warning alert
   */
  const showWarning = useCallback((title, message, details = null, actions = {}) => {
    showAlert({
      type: 'warning',
      title,
      message,
      details,
      primaryAction: actions.primaryAction,
      secondaryAction: actions.secondaryAction
    })
  }, [showAlert])

  /**
   * Show success alert (requires manual close by default)
   */
  const showSuccess = useCallback((title, message, details = null, autoClose = null) => {
    showAlert({
      type: 'success',
      title,
      message,
      details,
      autoClose
    })
  }, [showAlert])

  /**
   * Show info alert
   */
  const showInfo = useCallback((title, message, details = null, actions = {}) => {
    showAlert({
      type: 'info',
      title,
      message,
      details,
      primaryAction: actions.primaryAction,
      secondaryAction: actions.secondaryAction
    })
  }, [showAlert])

  /**
   * Show missing API key alert
   */
  const showMissingApiKeyAlert = useCallback((providerName, onOpenSettings) => {
    showWarning(
      'API Key Required',
      `${providerName} requires an API key to fetch available models.`,
      `You can add your API key in Settings → API Keys → ${providerName}`,
      {
        primaryAction: {
          label: 'Open Settings',
          handler: onOpenSettings
        },
        secondaryAction: {
          label: 'Continue with fallback models',
          handler: () => {}
        }
      }
    )
  }, [showWarning])

  /**
   * Show fetch error alert with retry
   */
  const showFetchErrorAlert = useCallback((providerName, errorMessage, onRetry) => {
    showError(
      'Failed to Fetch Models',
      `Could not connect to ${providerName} API.`,
      errorMessage,
      {
        primaryAction: onRetry ? {
          label: 'Retry',
          handler: onRetry
        } : null,
        secondaryAction: {
          label: 'Use Fallback Models',
          handler: () => {}
        }
      }
    )
  }, [showError])

  /**
   * Show invalid API key alert
   */
  const showInvalidApiKeyAlert = useCallback((providerName, errorDetails, onUpdateKey) => {
    showError(
      'Invalid API Key',
      `The ${providerName} API key you provided is not valid.`,
      errorDetails,
      {
        primaryAction: {
          label: 'Update API Key',
          handler: onUpdateKey
        },
        secondaryAction: {
          label: 'Dismiss',
          handler: () => {}
        }
      }
    )
  }, [showError])

  const value = {
    showAlert,
    showError,
    showWarning,
    showSuccess,
    showInfo,
    showMissingApiKeyAlert,
    showFetchErrorAlert,
    showInvalidApiKeyAlert,
    closeAlert
  }

  return (
    <ErrorContext.Provider value={value}>
      {children}
      {alert && (
        <AlertDialog
          open={true}
          onClose={closeAlert}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          details={alert.details}
          primaryAction={alert.primaryAction}
          secondaryAction={alert.secondaryAction}
          autoClose={alert.autoClose}
        />
      )}
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within ErrorProvider')
  }
  return context
}
