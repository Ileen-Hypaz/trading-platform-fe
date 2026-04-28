import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ErrorBanner } from './ErrorBanner'
import { SkeletonChartArea } from './Skeleton'
import { useToast } from './Toast'
import { type OHLCVBar, type Quote, ApiError, marketApi } from '../lib/api'

interface PriceChartProps {
  symbol: string
}

type ChartInterval = '5min' | 'daily' | 'weekly'

const INTERVALS: ChartInterval[] = ['5min', 'daily', 'weekly']

const INTERVAL_LABELS: Record<ChartInterval, string> = {
  '5min': '5m',
  daily: '1D',
  weekly: '1W',
}

interface ChartPoint {
  time: string
  close: number
  open: number
  high: number
  low: number
  volume: number
}

/**
 * Convert OHLCV bars to chart-ready points.
 *
 * For intraday intervals (e.g. "5min") Alpha Vantage timestamps are
 * "YYYY-MM-DD HH:mm:ss" — we show only "HH:mm" on the x-axis.
 * For daily/weekly timestamps ("YYYY-MM-DD") we show the full date.
 */
function toChartPoints(bars: OHLCVBar[], interval: string): ChartPoint[] {
  const isIntraday = interval.endsWith('min')
  return bars.map((b) => ({
    time: isIntraday ? b.timestamp.slice(11, 16) : b.timestamp.slice(0, 10),
    close: b.close,
    open: b.open,
    high: b.high,
    low: b.low,
    volume: b.volume,
  }))
}

// ---------------------------------------------------------------------------
// Header skeleton: symbol placeholder while first load is in flight
// ---------------------------------------------------------------------------

function ChartHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between mb-5 gap-4">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-slate-700/60 h-5 w-16" />
        <div className="animate-pulse rounded bg-slate-700/60 h-8 w-28" />
        <div className="animate-pulse rounded bg-slate-700/60 h-3 w-40" />
      </div>
      <div className="flex gap-1">
        {INTERVALS.map((iv) => (
          <div
            key={iv}
            className="animate-pulse rounded bg-slate-700/60 h-7 w-8"
          />
        ))}
      </div>
    </div>
  )
}

export function PriceChart({ symbol }: PriceChartProps) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [chartInterval, setChartInterval] = useState<ChartInterval>('daily')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDegradation, setIsDegradation] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    if (!symbol) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setIsDegradation(false)
    setQuote(null)
    setChartData([])

    Promise.all([marketApi.quote(symbol), marketApi.history(symbol, chartInterval)])
      .then(([quoteRes, histRes]) => {
        if (cancelled) return
        setQuote(quoteRes)
        setChartData(toChartPoints(histRes.bars, histRes.interval))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load market data'
        const degradation = err instanceof ApiError && err.isDegradation
        setError(message)
        setIsDegradation(degradation)
        addToast({
          type: 'warning',
          title: 'Market Data Unavailable',
          message: degradation
            ? 'Serving cached data — live prices may be delayed.'
            : 'Could not fetch market data. Check your connection.',
          duration: 6000,
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, chartInterval, addToast])

  const isPositive = quote !== null ? quote.change >= 0 : true
  const accentColor = isPositive ? '#22c55e' : '#ef4444'
  const gradientId = isPositive ? 'grad-green' : 'grad-red'
  const changeSign = isPositive ? '+' : ''

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      {/* Header: symbol + price + interval selector */}
      {loading && !quote ? (
        <ChartHeaderSkeleton />
      ) : (
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">{symbol}</h3>
            {quote !== null && (
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="text-2xl font-semibold text-white">
                  ${quote.price.toFixed(2)}
                </span>
                <span
                  className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                >
                  {changeSign}
                  {quote.change.toFixed(2)} ({changeSign}
                  {quote.change_percent.toFixed(2)}%)
                </span>
              </div>
            )}
            {quote !== null && (
              <p className="text-xs text-slate-500 mt-0.5">
                Vol {quote.volume.toLocaleString()} · {quote.latest_trading_day}
              </p>
            )}
          </div>

          <div className="flex gap-1 shrink-0">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setChartInterval(iv)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  chartInterval === iv
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-surface-border'
                }`}
              >
                {INTERVAL_LABELS[iv]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Degradation warning banner */}
      {!loading && error !== null && isDegradation && (
        <ErrorBanner
          type="warning"
          message="Market data is temporarily degraded — chart may show cached values."
          className="mb-4"
        />
      )}

      {/* Chart body */}
      {loading && <SkeletonChartArea />}

      {!loading && error !== null && !isDegradation && (
        <div className="h-52 flex items-center justify-center">
          <ErrorBanner
            type="error"
            message={error}
            className="w-full max-w-sm text-center"
          />
        </div>
      )}

      {!loading && (error === null || isDegradation) && chartData.length === 0 && (
        <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
          No chart data available for {symbol}
        </div>
      )}

      {!loading && (error === null || isDegradation) && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={54}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Close']}
            />

            <Area
              type="monotone"
              dataKey="close"
              stroke={accentColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
