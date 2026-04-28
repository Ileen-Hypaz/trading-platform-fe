import { useState, type FormEvent } from 'react'

export function Settings() {
  const [saved, setSaved] = useState(false)

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      <form onSubmit={handleSave} className="space-y-6">
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
        </section>
        <button
          type="submit"
          className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
