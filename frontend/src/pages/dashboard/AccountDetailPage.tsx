import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { accountApi } from "../../services/api";
import { useMoney } from '../../utils/useMoney';


export default function AccountDetailPage() {
  const { fmt } = useMoney();
  const { id } = useParams<{ id: string }>();
  const { data: acct } = useQuery({ queryKey:["account",id], queryFn:()=>accountApi.get(id!).then((r)=>r.data) });
  const { data: txs  } = useQuery({ queryKey:["acct-txs",id], queryFn:()=>accountApi.transactions(id!).then((r)=>r.data) });

  return (
    <div className="space-y-6">
      {acct && (
        <div className="bg-navy-600 rounded-xl p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-1 capitalize">{acct.account_type}</p>
          <p className="text-4xl font-mono font-bold">{fmt(parseFloat(acct.balance))}</p>
          <p className="text-white/50 text-sm mt-2">****{acct.account_number?.slice(-4)} · Routing {acct.routing_number}</p>
        </div>
      )}
      <div className="card">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Recent transactions</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {txs?.map((tx: any) => (
            <div key={tx.id} className="px-5 py-3 flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-700 capitalize">{tx.tx_type}{tx.description ? ` — ${tx.description}` : ""}</p>
                <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</p>
              </div>
              <p className={`font-mono text-sm font-medium ${tx.to_account_id === id ? "text-green-600" : "text-gray-700"}`}>
                {tx.to_account_id === id ? "+" : "-"}{fmt(parseFloat(tx.amount))}
              </p>
            </div>
          ))}
          {!txs?.length && <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
}