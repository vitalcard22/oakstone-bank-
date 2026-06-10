import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export default function AdminTransactionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [flagged, setFlagged] = useState(false);

  const { data: txs } = useQuery({
    queryKey: ["admin-txs", status, flagged],
    queryFn:  () => adminApi.transactions({ status: status || undefined, flagged: flagged || undefined }).then((r) => r.data),
  });

  const flagMut = useMutation({
    mutationFn: (id: string) => adminApi.flagTransaction(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-txs"]}); toast.success("Flagged"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">All transactions</h1>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="w-4 h-4 accent-red-600"/>
            Flagged only
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-36 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {["Reference","Type","Amount","Status","Risk",""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {txs?.map((tx: any) => (
              <tr key={tx.id} className={`hover:bg-gray-50/50 ${tx.flagged ? "bg-red-50/30" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.reference_id}</td>
                <td className="px-4 py-3 capitalize text-gray-700">{tx.tx_type}</td>
                <td className="px-4 py-3 font-mono">{fmt(parseFloat(tx.amount))}</td>
                <td className="px-4 py-3">
                  <span className={tx.status==="completed" ? "badge-green" : tx.status==="failed" ? "badge-red" : "badge-amber"}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.risk_score ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {!tx.flagged && (
                    <button onClick={() => flagMut.mutate(tx.id)} className="text-xs text-red-500 hover:underline">Flag</button>
                  )}
                  {tx.flagged && <span className="text-xs text-red-400">Flagged</span>}
                </td>
              </tr>
            ))}
            {!txs?.length && (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">No transactions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}