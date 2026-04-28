// ---------------------------------------------------------------------------
// ErrorBanner — distinguishes hard API errors (red) from degradation
// warnings (amber, e.g. stale market data, AI temporarily unavailable).
// ---------------------------------------------------------------------------

export type ErrorBannerType = 'error' | 'warning'

interface ErrorBannerProps {
  message: string
  type?: ErrorBannerType
  className?: string
}

export function ErrorBanner({ message, type = 'error', className }: ErrorBannerProps) {
  const styles =
    type === 'warning'
      ? 'bg-amber-900/30 border-amber-700/50 text-amber-300'
      : 'bg-red-900/40 border-red-700/50 text-red-300'

  const icon =
    type === 'warning' ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 shrink-0 mt-px"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m10.29 3.86-8.166 14A2 2 0 0 0 3.866 21h16.268a2 2 0 0 0 1.732-3l-8.165-14a2 2 0 0 0-3.464 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 shrink-0 mt-px"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    )

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border text-sm ${styles} ${className ?? ''}`}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}
