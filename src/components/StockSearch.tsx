import { useEffect, useRef, useState } from 'react'
import { type SearchResult, marketApi } from '../lib/api'

interface StockSearchProps {
  onSelect: (symbol: string) => void
}

export function StockSearch({ onSelect }: StockSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)

    if (query.length === 0) {
      setResults([])
      setIsOpen(false)
      setLoading(false)
      return
    }

    // Guard so in-flight responses that arrive after the query changed (or
    // after the component unmounts) do not update state with stale data.
    let cancelled = false

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      marketApi
        .search(query)
        .then((res) => {
          if (cancelled) return
          setResults(res.results.slice(0, 8))
          setIsOpen(res.results.length > 0)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setIsOpen(false)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (symbol: string) => {
    setQuery(symbol)
    setIsOpen(false)
    onSelect(symbol)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol…"
          className="w-full bg-surface-card border border-surface-border rounded-lg px-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500 transition-colors"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
            ···
          </span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-surface-card border border-surface-border rounded-lg shadow-xl overflow-hidden">
          {results.map((r) => (
            <li
              key={r.symbol}
              onClick={() => handleSelect(r.symbol)}
              className="px-4 py-2.5 cursor-pointer hover:bg-surface-border flex items-center justify-between gap-2"
            >
              <span className="text-white text-sm font-semibold shrink-0">{r.symbol}</span>
              <span className="text-slate-400 text-xs truncate text-right">{r.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
