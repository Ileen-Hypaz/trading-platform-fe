import { useState } from 'react'
import { PriceChart } from '../components/PriceChart'
import { StockSearch } from '../components/StockSearch'

export function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-white shrink-0">Dashboard</h2>
        <StockSearch onSelect={setSelectedSymbol} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Portfolio Value" value="$0.00" />
        <StatCard label="Today's P&L" value="$0.00" />
        <StatCard label="Open Positions" value="0" />
      </div>

      <PriceChart symbol={selectedSymbol} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
