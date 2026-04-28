import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner } from '../components/ErrorBanner'
import { PriceChart } from '../components/PriceChart'
import { SkeletonStatCard, SkeletonTableRow } from '../components/Skeleton'
import { StockSearch } from '../components/StockSearch'
import { brokerageApi, type PortfolioPositionsResponse } from '../lib/api'

const REFRESH_INTERVAL_MS = 30_000
const SKELETON_ROWS = 4

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function pnlClass(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-slate-300'
}

// ---------------------------------------------------------------------------
// Empty state for positions table
// ---------------------------------------------------------------------------

function EmptyPositions() {
  return (
    <tr>
      <td colSpan={7} className="px-6 py-12">
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
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <line x1="12" y1="12" x2="12" y2="16" />
            <line x1="10" y1="14" x2="14" y2="14" />
          </svg>
          <div>
            <p className="text-slate-300 font-medium text-sm">No Open Positions</p>
            <p className="text-slate-500 text-xs mt-1 max-w-xs">
              Your portfolio is empty. Head to{' '}
              <Link
                to="/suggestions"
                className="text-primary-500 hover:text-primary-400 underline-offset-2 hover:underline"
              >
                Suggestions
              </Link>{' '}
              to find AI-powered trading opportunities.
            </p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  const [portfolio, setPortfolio] = useState<PortfolioPositionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await brokerageApi.getPortfolio()
      setPortfolio(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPortfolio()
    const timer = setInterval(() => void fetchPortfolio(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchPortfolio])

  const totalValue = portfolio?.total_portfolio_value ?? 0
  const cashBalance = portfolio?.cash_balance ?? 0
  const unrealizedPnl = portfolio?.total_unrealized_pnl ?? 0
  const positionCount = portfolio?.positions.length ?? 0

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-white shrink-0">Dashboard</h2>
        <StockSearch onSelect={setSelectedSymbol} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <StatCard label="Portfolio Value" value={formatCurrency(totalValue)} />
            <StatCard label="Cash Balance" value={formatCurrency(cashBalance)} />
            <StatCard
              label="Unrealized P&L"
              value={formatCurrency(unrealizedPnl)}
              valueClass={pnlClass(unrealizedPnl)}
            />
            <StatCard label="Open Positions" value={String(positionCount)} />
          </>
        )}
      </div>

      {/* Error banner — only shown after first load */}
      {!loading && error && (
        <ErrorBanner
          type="error"
          message={`Portfolio data unavailable: ${error}. Displaying last known values.`}
          className="mb-6"
        />
      )}

      {/* Price chart */}
      <PriceChart symbol={selectedSymbol} />

      {/* Positions table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Positions</h3>
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Symbol</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Avg Cost</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">
                    Current Price
                  </th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">
                    Market Value
                  </th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">
                    Unrealized P&L
                  </th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">P&L %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={7} firstColWidth="w-12" />
                  ))
                ) : portfolio && portfolio.positions.length > 0 ? (
                  portfolio.positions.map((pos) => (
                    <tr
                      key={pos.id}
                      className="border-b border-surface-border last:border-0 hover:bg-surface-border/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-white">{pos.symbol}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {pos.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(pos.avg_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(pos.current_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(pos.market_value)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${pnlClass(pos.unrealized_pnl)}`}
                      >
                        {formatCurrency(pos.unrealized_pnl)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${pnlClass(pos.unrealized_pnl_pct)}`}
                      >
                        {formatPercent(pos.unrealized_pnl_pct)}
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      Could not load positions. Check your connection and try again.
                    </td>
                  </tr>
                ) : (
                  <EmptyPositions />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
