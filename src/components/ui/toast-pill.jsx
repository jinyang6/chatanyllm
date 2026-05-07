import { toast } from 'sonner'

function ToastPill({ message, actionLabel, onAction }) {
  return (
    <div className="bg-black text-white rounded-full px-5 py-3.5 shadow-lg flex items-center gap-6">
      <span className="text-sm font-semibold">{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-sm font-semibold shrink-0 text-black border border-[#DDD] bg-[#F9F9F9] hover:bg-white rounded-full px-5 py-1 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/**
 * Show a pill-shaped toast notification
 * @param {string} message - Text to display
 * @param {object} options
 * @param {string} options.actionLabel - Button label (e.g. "Open")
 * @param {function} options.onAction - Button click handler
 * @param {number} options.duration - Auto-dismiss delay in ms (default: 5000)
 */
export function showPillToast(message, options = {}) {
  const {
    actionLabel,
    onAction,
    duration = 5000,
  } = options

  toast.custom(
    (t) => (
      <ToastPill
        message={message}
        actionLabel={actionLabel}
        onAction={onAction ? () => { onAction(); toast.dismiss(t) } : undefined}
      />
    ),
    { duration }
  )
}
