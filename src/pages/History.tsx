export function History() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Trade History</h2>
      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Symbol</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Side</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Qty</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No trades recorded yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
