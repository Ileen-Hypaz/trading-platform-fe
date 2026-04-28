import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  /** Auto-dismiss delay in ms. Defaults to 4500. */
  duration?: number
}

interface ToastMessageInternal extends ToastMessage {
  exiting: boolean
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue>({
  addToast: () => undefined,
})

let idCounter = 0

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessageInternal[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 320)
  }, [])

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = String(++idCounter)
      setToasts((prev) => {
        const next: ToastMessageInternal[] = [
          ...prev,
          { ...toast, id, exiting: false },
        ]
        // Keep at most 5 toasts visible
        return next.slice(-5)
      })
      setTimeout(() => dismiss(id), toast.duration ?? 4500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

// ---------------------------------------------------------------------------
// Icons (inline SVG to avoid external dependencies)
// ---------------------------------------------------------------------------

function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  )
}

function ExclamationTriangleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.29 3.86-8.166 14A2 2 0 0 0 3.866 21h16.268a2 2 0 0 0 1.732-3 l-8.165-14a2 2 0 0 0-3.464 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function InformationCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Style map
// ---------------------------------------------------------------------------

interface ToastStyle {
  iconColor: string
  borderColor: string
  icon: ReactNode
}

const TOAST_STYLES: Record<ToastType, ToastStyle> = {
  success: {
    iconColor: 'text-emerald-400',
    borderColor: 'border-l-emerald-500',
    icon: <CheckCircleIcon />,
  },
  error: {
    iconColor: 'text-red-400',
    borderColor: 'border-l-red-500',
    icon: <XCircleIcon />,
  },
  warning: {
    iconColor: 'text-amber-400',
    borderColor: 'border-l-amber-500',
    icon: <ExclamationTriangleIcon />,
  },
  info: {
    iconColor: 'text-blue-400',
    borderColor: 'border-l-blue-500',
    icon: <InformationCircleIcon />,
  },
}

// ---------------------------------------------------------------------------
// ToastItem
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessageInternal
  onDismiss: (id: string) => void
}) {
  const [entered, setEntered] = useState(false)
  const style = TOAST_STYLES[toast.type]

  useEffect(() => {
    // Double rAF ensures the element is in the DOM before the transition starts
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [])

  const visible = entered && !toast.exiting

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 w-80 max-w-full
        bg-slate-800 border border-slate-700 border-l-4 ${style.borderColor}
        rounded-lg shadow-xl px-4 py-3
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      <span className={`mt-0.5 ${style.iconColor}`}>{style.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{toast.message}</p>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
        aria-label="Dismiss notification"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ToastContainer
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessageInternal[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end sm:top-4 sm:bottom-auto"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
