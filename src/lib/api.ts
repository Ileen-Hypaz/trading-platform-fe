const BASE_URL = import.meta.env['VITE_API_URL'] ?? ''

// API key for application-level Bearer authentication.
// When set, this token is injected on every mutating request so the backend's
// require_api_key dependency is satisfied.
//
// Production security model:
//   - Primary boundary: Cloud Run / IAP enforces Google-signed OIDC authentication
//     at the infrastructure level before any request reaches this service.
//   - Secondary boundary: APP_AUTH_ENABLED + APP_API_KEY adds an application-level
//     Bearer token check on all mutation endpoints.
//   - VITE_API_KEY should be provided via Cloud Run environment variables, never
//     committed to source control.
const _apiKey: string = import.meta.env['VITE_API_KEY'] ?? ''

// ---------------------------------------------------------------------------
// 401 handler hook — stub for future OAuth / Firebase integration
// ---------------------------------------------------------------------------
// Replace this no-op with a redirect to /login or a token-refresh flow when
// an auth provider (Firebase, Google OAuth, etc.) is wired up.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _handle401(_response: Response): void {
  // Future: trigger token refresh or redirect to login page.
}

// ---------------------------------------------------------------------------
// ApiError — richer error type that carries HTTP status + backend error code
// ---------------------------------------------------------------------------

interface ErrorResponseBody {
  message?: string
  error_code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly errorCode: string | null

  constructor(status: number, message: string, errorCode?: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode ?? null
  }

  /**
   * True for transient/external-service failures that may self-resolve
   * (e.g. market data provider down, AI service unavailable, 503/504).
   */
  get isDegradation(): boolean {
    return (
      this.status >= 503 ||
      this.errorCode === 'MARKET_DATA_UNAVAILABLE' ||
      this.errorCode === 'AI_SERVICE_UNAVAILABLE'
    )
  }

  /** True when a guardrail rule blocked the requested action. */
  get isGuardrailViolation(): boolean {
    return this.errorCode === 'GUARDRAIL_VIOLATION'
  }
}

async function parseErrorBody(response: Response): Promise<{ message: string; errorCode: string | null }> {
  let message = `Request failed (${response.status})`
  let errorCode: string | null = null
  try {
    const body = (await response.json()) as ErrorResponseBody
    if (body.message) message = body.message
    if (body.error_code) errorCode = body.error_code
  } catch {
    // Non-JSON body; keep default message
  }
  return { message, errorCode }
}

function _authHeaders(): Record<string, string> {
  if (_apiKey) {
    return { Authorization: `Bearer ${_apiKey}` }
  }
  return {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ..._authHeaders(),
      ...options?.headers,
    },
    ...options,
  })
  if (!response.ok) {
    if (response.status === 401) _handle401(response)
    const { message, errorCode } = await parseErrorBody(response)
    throw new ApiError(response.status, message, errorCode)
  }
  return response.json() as Promise<T>
}

async function requestNoContent(path: string, options?: RequestInit): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ..._authHeaders(),
      ...options?.headers,
    },
    ...options,
  })
  if (!response.ok) {
    if (response.status === 401) _handle401(response)
    const { message, errorCode } = await parseErrorBody(response)
    throw new ApiError(response.status, message, errorCode)
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) =>
    requestNoContent(path, { method: 'DELETE' }),
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

// ---------------------------------------------------------------------------
// Brokerage types
// ---------------------------------------------------------------------------

export type TradeSide = 'BUY' | 'SELL'

export interface OrderRequest {
  symbol: string
  qty: number
  side: TradeSide
  order_type: 'market'
}

export interface OrderResponse {
  id: string
  symbol: string
  side: TradeSide
  qty: number
  price: number
  total_amount: number
  status: string
  source: string
  executed_at: string | null
  created_at: string
}

export interface PositionOut {
  id: string
  symbol: string
  qty: number
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface PortfolioPositionsResponse {
  portfolio_id: string
  name: string
  cash_balance: number
  total_market_value: number
  total_portfolio_value: number
  total_unrealized_pnl: number
  positions: PositionOut[]
}

export interface BalanceResponse {
  portfolio_id: string
  name: string
  cash_balance: number
  initial_balance: number
}

export interface TradeOut {
  id: string
  symbol: string
  side: TradeSide
  qty: number
  price: number
  total_amount: number
  status: string
  source: string
  executed_at: string | null
  created_at: string
}

export interface TradeHistoryResponse {
  trades: TradeOut[]
  total: number
  page: number
  page_size: number
}

// ---------------------------------------------------------------------------
// Brokerage API helpers
// ---------------------------------------------------------------------------

export const brokerageApi = {
  placeOrder: (body: OrderRequest): Promise<OrderResponse> =>
    api.post<OrderResponse>('/api/v1/brokerage/orders', body),

  getPortfolio: (): Promise<PortfolioPositionsResponse> =>
    api.get<PortfolioPositionsResponse>('/api/v1/brokerage/portfolio'),

  getBalance: (): Promise<BalanceResponse> =>
    api.get<BalanceResponse>('/api/v1/brokerage/balance'),

  getTrades: (page: number = 1, pageSize: number = 20): Promise<TradeHistoryResponse> =>
    api.get<TradeHistoryResponse>(
      `/api/v1/brokerage/trades?page=${page}&page_size=${pageSize}`,
    ),
}

// ---------------------------------------------------------------------------
// Watchlist types
// ---------------------------------------------------------------------------

export interface WatchlistItem {
  id: string
  symbol: string
  name: string | null
  notes: string | null
  added_at: string
}

export interface WatchlistListResponse {
  items: WatchlistItem[]
  total: number
}

export interface WatchlistAddRequest {
  symbol: string
  name?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Watchlist API helpers
// ---------------------------------------------------------------------------

export const watchlistApi = {
  list: (): Promise<WatchlistListResponse> =>
    api.get<WatchlistListResponse>('/api/v1/watchlist'),

  add: (body: WatchlistAddRequest): Promise<WatchlistItem> =>
    api.post<WatchlistItem>('/api/v1/watchlist', body),

  remove: (symbol: string): Promise<void> =>
    api.delete(`/api/v1/watchlist/${encodeURIComponent(symbol)}`),
}

// ---------------------------------------------------------------------------
// Signals types
// ---------------------------------------------------------------------------

export type SignalAction = 'BUY' | 'SELL' | 'HOLD'

export interface SignalOut {
  id: string
  symbol: string
  action: SignalAction
  confidence: number
  rationale: string
  price_at_signal: number
  model_id: string
  generated_at: string
  // Optional observability fields (populated when available after migration 005)
  snapshot_id?: string
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
}

export interface LatestSignalsResponse {
  signals: SignalOut[]
  total: number
}

export interface GenerateSignalResponse {
  signals: SignalOut[]
  errors: Record<string, string>
}

// ---------------------------------------------------------------------------
// Signals API helpers
// ---------------------------------------------------------------------------

export const signalsApi = {
  getLatest: (): Promise<LatestSignalsResponse> =>
    api.get<LatestSignalsResponse>('/api/v1/signals/latest'),

  generate: (symbols: string[]): Promise<GenerateSignalResponse> =>
    api.post<GenerateSignalResponse>('/api/v1/signals/generate', { symbols }),

  getLatestForSymbol: (symbol: string): Promise<SignalOut> =>
    api.get<SignalOut>(`/api/v1/signals/latest/${encodeURIComponent(symbol)}`),
}

// ---------------------------------------------------------------------------
// Auto-trading types
// ---------------------------------------------------------------------------

export interface AutoTradingStatus {
  enabled: boolean
  paused: boolean
  pause_expires_in_seconds: number | null
}

export interface AutoTradingToggleResponse {
  enabled: boolean
  updated_at: string
}

export interface AutoTradeLogEntry {
  id: string
  run_id: string
  portfolio_id: string | null
  signal_id: string | null
  symbol: string
  action: string
  qty: number | null
  price: number | null
  outcome: string
  reason: string | null
  created_at: string
}

export interface AutoTradeLogsResponse {
  logs: AutoTradeLogEntry[]
  total: number
  page: number
  page_size: number
}

// ---------------------------------------------------------------------------
// Auto-trading API helpers
// ---------------------------------------------------------------------------

export const autoTradingApi = {
  getStatus: (): Promise<AutoTradingStatus> =>
    api.get<AutoTradingStatus>('/api/v1/auto-trading/status'),

  toggle: (enabled: boolean): Promise<AutoTradingToggleResponse> =>
    api.patch<AutoTradingToggleResponse>('/api/v1/auto-trading/toggle', { enabled }),

  getLogs: (page: number = 1, pageSize: number = 50): Promise<AutoTradeLogsResponse> =>
    api.get<AutoTradeLogsResponse>(
      `/api/v1/auto-trading/logs?page=${page}&page_size=${pageSize}`,
    ),
}

// ---------------------------------------------------------------------------
// Guardrails types
// ---------------------------------------------------------------------------

export interface RuleConfigOut {
  rule_name: string
  value: number
  enabled: boolean
  description: string | null
  updated_at: string
}

export interface RuleConfigUpdate {
  value?: number
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Guardrails API helpers
// ---------------------------------------------------------------------------

export const guardrailsApi = {
  listRules: (): Promise<RuleConfigOut[]> =>
    api.get<RuleConfigOut[]>('/api/v1/guardrails/rules'),

  updateRule: (ruleName: string, body: RuleConfigUpdate): Promise<RuleConfigOut> =>
    api.patch<RuleConfigOut>(
      `/api/v1/guardrails/rules/${encodeURIComponent(ruleName)}`,
      body,
    ),
}
