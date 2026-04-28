import { useCallback, useEffect, useState } from 'react'
import { PriceChart } from '../components/PriceChart'
import { StockSearch } from '../components/StockSearch'
import { brokerageApi, type PortfolioPositionsResponse } from '../lib/api'

const REFRESH_INTERVAL_MS = 30_000

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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white shrink-0">Dashboard</h2>
        <StockSearch onSelect={setSelectedSymbol} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Portfolio Value"
          value={loading ? '—' : formatCurrency(totalValue)}
        />
        <StatCard
          label="Cash Balance"
          value={loading ? '—' : formatCurrency(cashBalance)}
        />
        <StatCard
          label="Unrealized P&L"
          value={loading ? '—' : formatCurrency(unrealizedPnl)}
          valueClass={loading ? undefined : pnlClass(unrealizedPnl)}
        />
        <StatCard
          label="Open Positions"
          value={loading ? '—' : String(positionCount)}
        />
      </div>

      {/* Price chart */}
      <PriceChart symbol={selectedSymbol} />

      {/* Positions table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-3">Positions</h3>
        {error && (
          <div className="mb-3 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Symbol</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Avg Cost</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Current Price</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Market Value</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Unrealized P&L</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading positions…
                  </td>
                </tr>
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
                    <td className={`px-4 py-3 text-right font-medium ${pnlClass(pos.unrealized_pnl)}`}>
                      {formatCurrency(pos.unrealized_pnl)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${pnlClass(pos.unrealized_pnl_pct)}`}>
                      {formatPercent(pos.unrealized_pnl_pct)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {error ? 'Could not load positions.' : 'No open positions. Place a buy order to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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
