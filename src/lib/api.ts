const BASE_URL = import.meta.env['VITE_API_URL'] ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}

// ---------------------------------------------------------------------------
// Market data types
// ---------------------------------------------------------------------------

export interface SearchResult {
  symbol: string
  name: string
  type: string
  region: string
  currency: string
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface Quote {
  symbol: string
  price: number
  open: number
  high: number
  low: number
  previous_close: number
  change: number
  change_percent: number
  volume: number
  latest_trading_day: string
}

export interface OHLCVBar {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OHLCVResponse {
  symbol: string
  interval: string
  bars: OHLCVBar[]
}

export interface IndicatorValue {
  timestamp: string
  value: number
}

export interface MACDValue {
  timestamp: string
  macd: number
  signal: number
  histogram: number
}

export interface BollingerBandValue {
  timestamp: string
  upper: number
  middle: number
  lower: number
}

export interface TechnicalIndicators {
  symbol: string
  sma_20: IndicatorValue[]
  ema_20: IndicatorValue[]
  rsi_14: IndicatorValue[]
  macd: MACDValue[]
  bbands: BollingerBandValue[]
}

// ---------------------------------------------------------------------------
// Market data API helpers
// ---------------------------------------------------------------------------

export const marketApi = {
  search: (q: string): Promise<SearchResponse> =>
    api.get<SearchResponse>(`/api/v1/market/search?q=${encodeURIComponent(q)}`),

  quote: (symbol: string): Promise<Quote> =>
    api.get<Quote>(`/api/v1/market/quote/${encodeURIComponent(symbol)}`),

  history: (
    symbol: string,
    interval: string = 'daily',
    outputsize: string = 'compact',
  ): Promise<OHLCVResponse> =>
    api.get<OHLCVResponse>(
      `/api/v1/market/history/${encodeURIComponent(symbol)}?interval=${interval}&outputsize=${outputsize}`,
    ),

  indicators: (symbol: string): Promise<TechnicalIndicators> =>
    api.get<TechnicalIndicators>(`/api/v1/market/indicators/${encodeURIComponent(symbol)}`),
}
