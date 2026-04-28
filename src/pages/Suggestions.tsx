import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBanner } from '../components/ErrorBanner'
import { SkeletonSignalCard, SkeletonWatchlistItem } from '../components/Skeleton'
import { StockSearch } from '../components/StockSearch'
import { useToast } from '../components/Toast'
import {
  ApiError,
  brokerageApi,
  signalsApi,
  watchlistApi,
  type OrderResponse,
  type SignalAction,
  type SignalOut,
  type WatchlistItem,
} from '../lib/api'

// ---------------------------------------------------------------------------
// Utility: deduplicated symbol union from watchlist + open positions
// ---------------------------------------------------------------------------

async function collectAllSymbols(watchlistSymbols: string[]): Promise<string[]> {
  try {
    const portfolio = await brokerageApi.getPortfolio()
    const positionSymbols = portfolio.positions.map((p) => p.symbol)
    return Array.from(new Set([...watchlistSymbols, ...positionSymbols]))
  } catch {
    // Portfolio fetch is best-effort; fall back to watchlist-only symbols.
    return watchlistSymbols
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

// ---------------------------------------------------------------------------
// Badge styling for signal action type
// ---------------------------------------------------------------------------

interface ActionStyle {
  badge: string
  border: string
  executeBtnClass: string
}

const ACTION_STYLES: Record<SignalAction, ActionStyle> = {
  BUY: {
    badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    border: 'border-emerald-500/20',
    executeBtnClass: 'bg-emerald-700/60 hover:bg-emerald-600 text-emerald-200 border border-emerald-600/40',
  },
  SELL: {
    badge: 'bg-red-500/20 text-red-300 border border-red-500/40',
    border: 'border-red-500/20',
    executeBtnClass: 'bg-red-700/60 hover:bg-red-600 text-red-200 border border-red-600/40',
  },
  HOLD: {
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    border: 'border-amber-500/20',
    executeBtnClass: '',
  },
}

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.7) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
  if (confidence >= 0.4) return 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
  return 'bg-red-500/10 text-red-400 border border-red-500/30'
}

// ---------------------------------------------------------------------------
// Trade confirmation form state (local to each SignalCard)
// ---------------------------------------------------------------------------

interface TradeFormState {
  open: boolean
  qty: string
  submitting: boolean
  error: string | null
  errorType: 'error' | 'warning'
  result: OrderResponse | null
}

const EMPTY_TRADE_FORM: TradeFormState = {
  open: false,
  qty: '1',
  submitting: false,
  error: null,
  errorType: 'error',
  result: null,
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-current"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// SignalCard
// ---------------------------------------------------------------------------

interface SignalCardProps {
  signal: SignalOut
  onDismiss: (id: string) => void
}

function SignalCard({ signal, onDismiss }: SignalCardProps) {
  const [form, setForm] = useState<TradeFormState>(EMPTY_TRADE_FORM)
  const { addToast } = useToast()
  const style = ACTION_STYLES[signal.action]
  const canTrade = signal.action === 'BUY' || signal.action === 'SELL'

  const handleQtyChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, qty: e.target.value, error: null }))
  }

  const handleExecute = async () => {
    const qty = parseFloat(form.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setForm((prev) => ({ ...prev, error: 'Enter a positive quantity.', errorType: 'error' }))
      return
    }
    setForm((prev) => ({ ...prev, submitting: true, error: null }))
    try {
      const result = await brokerageApi.placeOrder({
        symbol: signal.symbol,
        qty,
        side: signal.action as 'BUY' | 'SELL',
        order_type: 'market',
      })
      setForm((prev) => ({ ...prev, submitting: false, result }))
      addToast({
        type: 'success',
        title: 'Trade Executed',
        message: `${result.side} ${result.qty.toLocaleString()} × ${result.symbol} @ ${formatCurrency(result.price)}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Order failed.'
      const isGuardrail = err instanceof ApiError && err.isGuardrailViolation
      setForm((prev) => ({
        ...prev,
        submitting: false,
        error: message,
        errorType: isGuardrail ? 'warning' : 'error',
      }))
      if (isGuardrail) {
        addToast({
          type: 'warning',
          title: 'Guardrail Triggered',
          message,
          duration: 7000,
        })
      } else {
        addToast({
          type: 'error',
          title: 'Trade Failed',
          message,
        })
      }
    }
  }

  return (
    <div
      className={`bg-surface-card border ${style.border} rounded-xl p-5 flex flex-col gap-4`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xl font-bold text-white tracking-tight">{signal.symbol}</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${style.badge}`}
          >
            {signal.action}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${confidenceBadgeClass(signal.confidence)}`}
          >
            {formatConfidence(signal.confidence)} confidence
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          <span>{formatTimestamp(signal.generated_at)}</span>
          <span>·</span>
          <span>{formatCurrency(signal.price_at_signal)}</span>
        </div>
      </div>

      {/* Rationale */}
      <p className="text-slate-300 text-sm leading-relaxed">{signal.rationale}</p>

      {/* Order confirmation form */}
      {form.result ? (
        <div className="bg-emerald-900/30 border border-emerald-600/30 rounded-lg px-4 py-3 text-sm">
          <p className="text-emerald-300 font-semibold mb-1">Order placed ✓</p>
          <p className="text-slate-400">
            {form.result.side} {form.result.qty.toLocaleString()} × {form.result.symbol} @{' '}
            {formatCurrency(form.result.price)} — total{' '}
            {formatCurrency(form.result.total_amount)}
          </p>
        </div>
      ) : form.open ? (
        <div className="bg-surface border border-surface-border rounded-lg px-4 py-3">
          <p className="text-slate-300 text-sm font-medium mb-3">
            Confirm{' '}
            <span className="font-bold text-white">{signal.action}</span> order for{' '}
            <span className="font-bold text-white">{signal.symbol}</span>
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label
                htmlFor={`qty-${signal.id}`}
                className="text-slate-400 text-xs shrink-0"
              >
                Quantity
              </label>
              <input
                id={`qty-${signal.id}`}
                type="number"
                min="0.0001"
                step="1"
                value={form.qty}
                onChange={handleQtyChange}
                disabled={form.submitting}
                className="w-24 bg-surface-card border border-surface-border rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => void handleExecute()}
              disabled={form.submitting}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                signal.action === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {form.submitting && <Spinner />}
              {form.submitting ? 'Placing…' : `Confirm ${signal.action}`}
            </button>
            <button
              onClick={() => setForm(EMPTY_TRADE_FORM)}
              disabled={form.submitting}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-surface-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {form.error && (
            <ErrorBanner
              type={form.errorType}
              message={form.error}
              className="mt-3"
            />
          )}
        </div>
      ) : null}

      {/* Action buttons */}
      {!form.result && (
        <div className="flex items-center gap-2 flex-wrap">
          {canTrade && !form.open && (
            <button
              onClick={() => setForm((prev) => ({ ...prev, open: true }))}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${style.executeBtnClass}`}
            >
              Execute Trade
            </button>
          )}
          {!canTrade && !form.open && (
            <span className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-surface border border-surface-border">
              HOLD — no trade action
            </span>
          )}
          <button
            onClick={() => onDismiss(signal.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-surface-border transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WatchlistManager
// ---------------------------------------------------------------------------

interface WatchlistManagerProps {
  watchlist: WatchlistItem[]
  onAdd: (symbol: string) => Promise<void>
  onRemove: (symbol: string) => Promise<void>
  loading: boolean
  error: string | null
}

function WatchlistManager({
  watchlist,
  onAdd,
  onRemove,
  loading,
  error,
}: WatchlistManagerProps) {
  // selectedRef holds the symbol chosen in StockSearch; cleared after add.
  const selectedRef = useRef<string | null>(null)
  // searchKey is bumped after a successful add to remount StockSearch (clearing input).
  const [searchKey, setSearchKey] = useState(0)
  const [addError, setAddError] = useState<string | null>(null)
  const [addingSymbol, setAddingSymbol] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const handleStockSelect = (symbol: string) => {
    selectedRef.current = symbol
    setAddError(null)
  }

  const handleAdd = async () => {
    const symbol = selectedRef.current
    if (!symbol) {
      setAddError('Search for and select a symbol first.')
      return
    }
    setAddError(null)
    setAddingSymbol(true)
    try {
      await onAdd(symbol)
      selectedRef.current = null
      setSearchKey((k) => k + 1)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add symbol.')
    } finally {
      setAddingSymbol(false)
    }
  }

  const handleRemove = async (symbol: string) => {
    setRemovingSymbol(symbol)
    setRemoveError(null)
    try {
      await onRemove(symbol)
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove symbol.')
    } finally {
      setRemovingSymbol(null)
    }
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <h3 className="text-base font-semibold text-white mb-4">Watchlist</h3>

      {/* Add symbol */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="flex-1 min-w-40">
          <StockSearch key={searchKey} onSelect={handleStockSelect} />
        </div>
        <button
          onClick={() => void handleAdd()}
          disabled={addingSymbol}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {addingSymbol ? 'Adding…' : 'Add'}
        </button>
      </div>

      {addError && <p className="mb-3 text-red-400 text-xs">{addError}</p>}

      {error && (
        <ErrorBanner type="error" message={error} className="mb-3" />
      )}

      {removeError && (
        <ErrorBanner type="error" message={removeError} className="mb-3" />
      )}

      <div className="mt-4">
        {loading ? (
          <ul className="divide-y divide-surface-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonWatchlistItem key={i} />
            ))}
          </ul>
        ) : watchlist.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Your watchlist is empty. Search above to add symbols.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {watchlist.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5 gap-3">
                <div>
                  <span className="text-white font-semibold text-sm">{item.symbol}</span>
                  {item.name && (
                    <span className="ml-2 text-slate-500 text-xs truncate">{item.name}</span>
                  )}
                </div>
                <button
                  onClick={() => void handleRemove(item.symbol)}
                  disabled={removingSymbol === item.symbol}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
                >
                  {removingSymbol === item.symbol ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state for signals panel
// ---------------------------------------------------------------------------

function EmptySignals({ hasWatchlistItems }: { hasWatchlistItems: boolean }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-6 py-14 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10 text-slate-600 mx-auto mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547Z" />
      </svg>
      <p className="text-slate-300 font-medium text-sm mb-2">No AI Signals Yet</p>
      {hasWatchlistItems ? (
        <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
          Click{' '}
          <span className="text-white font-semibold">Refresh Signals</span> to generate
          AI-powered trading recommendations for your watchlist.
        </p>
      ) : (
        <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
          Add symbols to your watchlist using the panel on the right, then click{' '}
          <span className="text-white font-semibold">Refresh Signals</span> to generate
          AI-powered trading recommendations.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suggestions page
// ---------------------------------------------------------------------------

const SKELETON_SIGNAL_COUNT = 3

export function Suggestions() {
  const [signals, setSignals] = useState<SignalOut[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])

  const [loadingSignals, setLoadingSignals] = useState(true)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [signalsError, setSignalsError] = useState<string | null>(null)
  const [signalsErrorType, setSignalsErrorType] = useState<'error' | 'warning'>('error')
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const { addToast } = useToast()

  // -------------------------------------------------------------------------
  // Fetchers
  // -------------------------------------------------------------------------

  const fetchSignals = useCallback(async () => {
    try {
      const data = await signalsApi.getLatest()
      setSignals(data.signals)
      setSignalsError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load signals.'
      const isDegradation = err instanceof ApiError && err.isDegradation
      setSignalsError(message)
      setSignalsErrorType(isDegradation ? 'warning' : 'error')
    } finally {
      setLoadingSignals(false)
    }
  }, [])

  const fetchWatchlist = useCallback(async () => {
    try {
      const data = await watchlistApi.list()
      setWatchlist(data.items)
      setWatchlistError(null)
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : 'Failed to load watchlist.')
    } finally {
      setLoadingWatchlist(false)
    }
  }, [])

  useEffect(() => {
    void fetchSignals()
    void fetchWatchlist()
  }, [fetchSignals, fetchWatchlist])

  // -------------------------------------------------------------------------
  // Refresh signals — generate for all watchlist + portfolio symbols
  // -------------------------------------------------------------------------

  const handleRefreshSignals = async () => {
    const watchlistSymbols = watchlist.map((w) => w.symbol)
    const symbols = await collectAllSymbols(watchlistSymbols)
    if (symbols.length === 0) {
      setRefreshError('Add symbols to your watchlist before generating signals.')
      return
    }
    setRefreshing(true)
    setRefreshError(null)
    try {
      await signalsApi.generate(symbols)
      await fetchSignals()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signal generation failed.'
      const isDegradation = err instanceof ApiError && err.isDegradation
      setRefreshError(message)
      addToast({
        type: 'warning',
        title: 'AI Signals Unavailable',
        message: isDegradation
          ? 'The AI service is temporarily unavailable. Try again in a few moments.'
          : message,
        duration: 7000,
      })
    } finally {
      setRefreshing(false)
    }
  }

  // -------------------------------------------------------------------------
  // Watchlist mutations
  // -------------------------------------------------------------------------

  const handleAddToWatchlist = async (symbol: string) => {
    await watchlistApi.add({ symbol })
    await fetchWatchlist()
    await fetchSignals()
  }

  const handleRemoveFromWatchlist = async (symbol: string) => {
    await watchlistApi.remove(symbol)
    await fetchWatchlist()
  }

  // -------------------------------------------------------------------------
  // Dismiss a signal card from the active view
  // -------------------------------------------------------------------------

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  const visibleSignals = signals.filter((s) => !dismissedIds.has(s.id))

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Page header with Refresh control */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Suggestions</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Claude Sonnet 4.5 trading signals for your watchlist
          </p>
        </div>
        <button
          onClick={() => void handleRefreshSignals()}
          disabled={refreshing || loadingWatchlist}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {refreshing ? (
            <>
              <Spinner />
              Generating…
            </>
          ) : (
            'Refresh Signals'
          )}
        </button>
      </div>

      {refreshError && (
        <ErrorBanner type="warning" message={refreshError} className="mb-4" />
      )}

      {/* Two-column layout: signals left, watchlist sidebar right */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Signal cards */}
        <section className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Signals
            </h3>
            {!loadingSignals && visibleSignals.length > 0 && (
              <span className="text-xs text-slate-500">
                {visibleSignals.length} signal{visibleSignals.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {signalsError && (
            <ErrorBanner
              type={signalsErrorType}
              message={
                signalsErrorType === 'warning'
                  ? `AI signal service degraded: ${signalsError}`
                  : signalsError
              }
              className="mb-3"
            />
          )}

          {loadingSignals ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: SKELETON_SIGNAL_COUNT }).map((_, i) => (
                <SkeletonSignalCard key={i} />
              ))}
            </div>
          ) : visibleSignals.length === 0 ? (
            <EmptySignals hasWatchlistItems={watchlist.length > 0} />
          ) : (
            <div className="flex flex-col gap-4">
              {visibleSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </section>

        {/* Watchlist sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Manage Watchlist
          </h3>
          <WatchlistManager
            watchlist={watchlist}
            onAdd={handleAddToWatchlist}
            onRemove={handleRemoveFromWatchlist}
            loading={loadingWatchlist}
            error={watchlistError}
          />
        </aside>
      </div>
    </div>
  )
}
