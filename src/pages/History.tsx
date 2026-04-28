import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner } from '../components/ErrorBanner'
import { SkeletonTableRow } from '../components/Skeleton'
import { brokerageApi, type TradeHistoryResponse, type TradeOut } from '../lib/api'

const PAGE_SIZE = 20
const SKELETON_ROWS = 8

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SideBadge({ side }: { side: TradeOut['side'] }) {
  const isBuy = side === 'BUY'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        isBuy
          ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
          : 'bg-red-900/50 text-red-400 border border-red-700'
      }`}
    >
      {side}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyHistory() {
  return (
    <tr>
      <td colSpan={8} className="px-6 py-14">
        <div className="flex flex-col items-center text-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-slate-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <div>
            <p className="text-slate-300 font-medium text-sm">No Trade History</p>
            <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
              Trades you execute will appear here. Head to{' '}
              <Link
                to="/suggestions"
                className="text-primary-500 hover:text-primary-400 underline-offset-2 hover:underline"
              >
                Suggestions
              </Link>{' '}
              to find AI-generated trading signals.
            </p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// History page
// ---------------------------------------------------------------------------

export function History() {
  const [data, setData] = useState<TradeHistoryResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrades = useCallback(async (targetPage: number) => {
    setLoading(true)
    try {
      const result = await brokerageApi.getTrades(targetPage, PAGE_SIZE)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trade history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTrades(page)
  }, [fetchTrades, page])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  function handlePrev() {
    if (page > 1) setPage((p) => p - 1)
  }

  function handleNext() {
    if (page < totalPages) setPage((p) => p + 1)
  }

  return (
    <div className="p-4 sm:p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Trade History</h2>

      {!loading && error && (
        <ErrorBanner
          type="error"
          message={`Failed to load trade history: ${error}`}
          className="mb-4"
        />
      )}

      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Symbol</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Side</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Price</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={8} firstColWidth="w-24" />
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                    Could not load trade history. Check your connection and try refreshing.
                  </td>
                </tr>
              ) : data && data.trades.length > 0 ? (
                data.trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-surface-border last:border-0 hover:bg-surface-border/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {formatDate(trade.executed_at ?? trade.created_at)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <SideBadge side={trade.side} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {trade.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatCurrency(trade.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatCurrency(trade.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">
                      {trade.status.toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">
                      {trade.source.toLowerCase()}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyHistory />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} trades
          </p>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-surface-border text-slate-300 disabled:opacity-40 hover:bg-surface-border/50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-surface-border text-slate-300 disabled:opacity-40 hover:bg-surface-border/50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
