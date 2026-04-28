import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  autoTradingApi,
  guardrailsApi,
  type AutoTradingStatus,
  type AutoTradeLogsResponse,
  type RuleConfigOut,
} from '../lib/api'

const LOG_PAGE_SIZE = 50
const POLL_INTERVAL_MS = 30_000

// ---------------------------------------------------------------------------
// Rule metadata — display labels, units, and original seed defaults
// ---------------------------------------------------------------------------

type RuleUnit = 'percent' | 'count'

interface RuleMeta {
  label: string
  unit: RuleUnit
  defaultValue: number
  step: string
}

const RULE_META: Record<string, RuleMeta> = {
  max_risk_per_trade: {
    label: 'Max Risk per Trade',
    unit: 'percent',
    defaultValue: 0.02,
    step: '0.1',
  },
  stop_loss_pct: {
    label: 'Stop-Loss',
    unit: 'percent',
    defaultValue: 0.05,
    step: '0.1',
  },
  take_profit_pct: {
    label: 'Take-Profit',
    unit: 'percent',
    defaultValue: 0.1,
    step: '0.1',
  },
  daily_loss_cap: {
    label: 'Daily Loss Cap',
    unit: 'percent',
    defaultValue: 0.06,
    step: '0.1',
  },
  max_concurrent_positions: {
    label: 'Max Concurrent Positions',
    unit: 'count',
    defaultValue: 5,
    step: '1',
  },
  max_daily_trades: {
    label: 'Max Daily Trades',
    unit: 'count',
    defaultValue: 10,
    step: '1',
  },
}

/** Convert stored decimal → display string (0.02 → "2.0" for percent, 5 → "5" for count). */
function toDisplay(ruleName: string, value: number): string {
  const meta = RULE_META[ruleName]
  if (!meta) return String(value)
  return meta.unit === 'percent' ? (value * 100).toFixed(1) : String(Math.round(value))
}

/** Convert display string → stored decimal ("2" → 0.02 for percent, "5" → 5 for count). */
function fromDisplay(ruleName: string, input: string): number {
  const num = parseFloat(input)
  const meta = RULE_META[ruleName]
  if (!meta || meta.unit === 'count') return num
  return num / 100
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  loading,
  onChange,
}: {
  enabled: boolean
  loading: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={loading}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        enabled ? 'bg-primary-600' : 'bg-surface-border'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    executed: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
    skipped: 'bg-amber-900/50 text-amber-400 border border-amber-700',
    blocked: 'bg-red-900/50 text-red-400 border border-red-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        styles[outcome] ?? 'bg-surface-border text-slate-400'
      }`}
    >
      {outcome}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    BUY: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
    SELL: 'bg-red-900/50 text-red-400 border border-red-700',
    HOLD: 'bg-amber-900/50 text-amber-400 border border-amber-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        styles[action] ?? 'bg-surface-border text-slate-400'
      }`}
    >
      {action}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section: Auto-Trading Toggle + Pause Banner
// ---------------------------------------------------------------------------

function AutoTradingPanel() {
  const [status, setStatus] = useState<AutoTradingStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void autoTradingApi
      .getStatus()
      .then((s) => {
        if (!cancelled) {
          setStatus(s)
          setLoadingStatus(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load status')
          setLoadingStatus(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleToggle(val: boolean) {
    setToggling(true)
    setError(null)
    try {
      const result = await autoTradingApi.toggle(val)
      setStatus((prev) => (prev ? { ...prev, enabled: result.enabled } : null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-trading state')
    } finally {
      setToggling(false)
    }
  }

  return (
    <section className="bg-surface-card border border-surface-border rounded-xl p-6">
      <h3 className="text-base font-semibold text-white mb-4">Auto-Trading</h3>

      {status?.paused && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-900/30 border border-amber-700 rounded-lg">
          <svg
            className="shrink-0 mt-0.5 h-5 w-5 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Daily Loss Cap Reached — Auto-trading Paused
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              The daily loss cap guardrail has triggered. Auto-trading will not execute any further
              trades today.
              {status.pause_expires_in_seconds != null && (
                <>
                  {' '}
                  Resumes in approximately{' '}
                  <strong>{formatSeconds(status.pause_expires_in_seconds)}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Enable Auto-Trading</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {loadingStatus
              ? 'Loading…'
              : status?.enabled
                ? 'Active — the scheduler will execute trades automatically on each trigger.'
                : 'Disabled — no trades will be executed automatically.'}
          </p>
        </div>
        <ToggleSwitch
          enabled={status?.enabled ?? false}
          loading={loadingStatus || toggling}
          onChange={(val) => void handleToggle(val)}
        />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Guardrail Rules Editor
// ---------------------------------------------------------------------------

interface RuleFormState {
  inputValue: string
  enabled: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

function GuardrailRulesPanel() {
  const [rules, setRules] = useState<RuleConfigOut[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [formState, setFormState] = useState<Record<string, RuleFormState>>({})

  useEffect(() => {
    void guardrailsApi
      .listRules()
      .then((data) => {
        setRules(data)
        const initial: Record<string, RuleFormState> = {}
        for (const rule of data) {
          initial[rule.rule_name] = {
            inputValue: toDisplay(rule.rule_name, rule.value),
            enabled: rule.enabled,
            saving: false,
            saved: false,
            error: null,
          }
        }
        setFormState(initial)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load guardrail rules')
        setLoading(false)
      })
  }, [])

  function setInputValue(ruleName: string, value: string) {
    setFormState((prev) => ({
      ...prev,
      [ruleName]: { ...prev[ruleName], inputValue: value, saved: false, error: null },
    }))
  }

  function setRuleEnabled(ruleName: string, value: boolean) {
    setFormState((prev) => ({
      ...prev,
      [ruleName]: { ...prev[ruleName], enabled: value, saved: false, error: null },
    }))
  }

  async function saveRule(ruleName: string) {
    const state = formState[ruleName]
    if (!state) return

    const newValue = fromDisplay(ruleName, state.inputValue)
    if (isNaN(newValue) || newValue <= 0) {
      setFormState((prev) => ({
        ...prev,
        [ruleName]: { ...prev[ruleName], error: 'Value must be a positive number.' },
      }))
      return
    }

    setFormState((prev) => ({
      ...prev,
      [ruleName]: { ...prev[ruleName], saving: true, error: null },
    }))

    try {
      const updated = await guardrailsApi.updateRule(ruleName, {
        value: newValue,
        enabled: state.enabled,
      })
      setRules((prev) => prev.map((r) => (r.rule_name === ruleName ? updated : r)))
      setFormState((prev) => ({
        ...prev,
        [ruleName]: {
          inputValue: toDisplay(updated.rule_name, updated.value),
          enabled: updated.enabled,
          saving: false,
          saved: true,
          error: null,
        },
      }))
      setTimeout(() => {
        setFormState((prev) => ({
          ...prev,
          [ruleName]: { ...prev[ruleName], saved: false },
        }))
      }, 2000)
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        [ruleName]: {
          ...prev[ruleName],
          saving: false,
          error: err instanceof Error ? err.message : 'Save failed',
        },
      }))
    }
  }

  return (
    <section className="bg-surface-card border border-surface-border rounded-xl p-6">
      <h3 className="text-base font-semibold text-white mb-1">Guardrail Rules</h3>
      <p className="text-xs text-slate-400 mb-4">
        Risk controls evaluated before every auto-trade execution. Changes take effect immediately.
      </p>

      {fetchError && (
        <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {fetchError}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm py-4">Loading rules…</p>
      ) : (
        <div>
          {rules.map((rule) => {
            const meta = RULE_META[rule.rule_name]
            const state = formState[rule.rule_name]
            if (!state) return null
            const unitLabel = meta?.unit === 'percent' ? '%' : ''
            const defaultDisplay = meta
              ? `${toDisplay(rule.rule_name, meta.defaultValue)}${unitLabel}`
              : '—'

            return (
              <div
                key={rule.rule_name}
                className="py-4 border-b border-surface-border last:border-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Rule info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white">
                        {meta?.label ?? rule.rule_name}
                      </p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          state.enabled
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-surface-border text-slate-500'
                        }`}
                      >
                        {state.enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{rule.description ?? ''}</p>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      Default:{' '}
                      <span className="text-slate-400 font-mono">{defaultDisplay}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step={meta?.step ?? '0.1'}
                        min={meta?.unit === 'count' ? '1' : '0.1'}
                        value={state.inputValue}
                        disabled={state.saving}
                        onChange={(e) => setInputValue(rule.rule_name, e.target.value)}
                        className="w-24 bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-white text-right font-mono focus:outline-none focus:border-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      {unitLabel && (
                        <span className="text-sm text-slate-400">{unitLabel}</span>
                      )}
                    </div>

                    <ToggleSwitch
                      enabled={state.enabled}
                      loading={state.saving}
                      onChange={(val) => setRuleEnabled(rule.rule_name, val)}
                    />

                    <button
                      type="button"
                      disabled={state.saving}
                      onClick={() => void saveRule(rule.rule_name)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                        state.saved
                          ? 'bg-emerald-700 text-emerald-100'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                    >
                      {state.saving ? 'Saving…' : state.saved ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                </div>

                {state.error && (
                  <p className="text-xs text-red-400 mt-2">{state.error}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section: Auto-Trade Activity Log
// ---------------------------------------------------------------------------

function ActivityLogPanel() {
  const [data, setData] = useState<AutoTradeLogsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(
    async (targetPage: number) => {
      try {
        const result = await autoTradingApi.getLogs(targetPage, LOG_PAGE_SIZE)
        setData(result)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity log')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void fetchLogs(page)
    const timer = setInterval(() => void fetchLogs(page), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchLogs, page])

  const totalPages = data ? Math.ceil(data.total / LOG_PAGE_SIZE) : 1

  return (
    <section className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Auto-Trade Activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">Every signal evaluation from the scheduler</p>
        </div>
        <span className="text-xs text-slate-500">Refreshes every 30s</span>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">
                Timestamp
              </th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Symbol</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Direction</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Outcome</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Price</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : data && data.logs.length > 0 ? (
              data.logs.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-surface-border last:border-0 hover:bg-surface-border/30 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">{entry.symbol}</td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={entry.outcome} />
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">
                    {entry.qty != null
                      ? entry.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">
                    {entry.price != null ? formatCurrency(entry.price) : '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate"
                    title={entry.reason ?? ''}
                  >
                    {entry.reason ?? '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {error
                    ? 'Could not load activity log.'
                    : 'No auto-trade activity recorded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > LOG_PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * LOG_PAGE_SIZE + 1}–
            {Math.min(page * LOG_PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-surface-border text-slate-300 disabled:opacity-40 hover:bg-surface-border/50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-surface-border text-slate-300 disabled:opacity-40 hover:bg-surface-border/50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function Settings() {
  const [brokerSaved, setBrokerSaved] = useState(false)

  function handleBrokerSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBrokerSaved(true)
    setTimeout(() => setBrokerSaved(false), 2000)
  }

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      <AutoTradingPanel />
      <GuardrailRulesPanel />
      <ActivityLogPanel />

      {/* Broker Configuration */}
      <form onSubmit={handleBrokerSave}>
        <section className="bg-surface-card border border-surface-border rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">Broker Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Broker Mode</label>
              <select className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
                <option value="paper">Paper Trading</option>
                <option value="alpaca">Alpaca</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {brokerSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}
