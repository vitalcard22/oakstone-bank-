import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cardApi } from "../../services/api";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

const GRAD: Record<string,string> = {
  classic:"from-gray-700 to-gray-500",
  gold:"from-yellow-700 to-yellow-500",
  platinum:"from-slate-800 to-slate-600",
};

export default function CardsPage() {
  const qc = useQueryClient();
  const { data: cards } = useQuery({ queryKey:["cards"], queryFn:()=>cardApi.list().then((r)=>r.data) });
  const { data: apps  } = useQuery({ queryKey:["card-apps"], queryFn:()=>cardApi.applications().then((r)=>r.data) });
  const freezeMut   = useMutation({ mutationFn:(id:string)=>cardApi.freeze(id),   onSuccess:()=>{ qc.invalidateQueries({queryKey:["cards"]}); toast.success("Card frozen"); }});
  const unfreezeMut = useMutation({ mutationFn:(id:string)=>cardApi.unfreeze(id), onSuccess:()=>{ qc.invalidateQueries({queryKey:["cards"]}); toast.success("Card unfrozen"); }});
  const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">Credit cards</h1>
        <Link to="/cards/apply" className="btn-primary px-4 py-2 text-sm inline-block">Apply for a card</Link>
      </div>

      {cards?.map((c: any) => (
        <div key={c.id} className="card overflow-hidden">
          <div className={`bg-gradient-to-br ${GRAD[c.card_type]||"from-gray-700 to-gray-500"} p-6 text-white`}>
            <div className="flex justify-between items-start mb-8">
              <span className="text-xs uppercase tracking-widest opacity-75">Oakstone</span>
              <span className={c.status==="active" ? "badge-green" : "badge-red"}>{c.status}</span>
            </div>
            <p className="font-mono text-sm opacity-75 mb-1">**** **** **** {c.card_last4}</p>
            <p className="font-semibold capitalize">{c.card_type} Rewards</p>
          </div>
          <div className="p-5 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">Available credit</p>
              <p className="font-mono font-semibold">{fmt(parseFloat(c.credit_limit) - parseFloat(c.balance))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Limit</p>
              <p className="font-mono">{fmt(parseFloat(c.credit_limit))}</p>
            </div>
            {c.status === "active" ? (
              <button onClick={()=>freezeMut.mutate(c.id)}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50">
                Freeze
              </button>
            ) : c.frozen_by === "admin" ? (
              <div className="text-right max-w-[150px]">
                <p className="text-xs font-medium text-red-600">Frozen by Oakstone</p>
                <p className="text-[11px] text-gray-400 leading-tight">Contact support to unlock</p>
              </div>
            ) : (
              <button onClick={()=>unfreezeMut.mutate(c.id)}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50">
                Unfreeze
              </button>
            )}
          </div>
        </div>
      ))}

      {apps?.filter((a: any)=>a.status!=="approved").map((a: any) => (
        <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-amber-900 capitalize">{a.card_type} card application</p>
              <p className="text-xs text-amber-700 mt-0.5 capitalize">{a.status.replace(/_/g," ")}</p>
            </div>
            {a.status==="pending_fee" && (
              <Link to="/cards/apply" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md">Pay fee</Link>
            )}
          </div>
        </div>
      ))}

      {!cards?.length && !apps?.length && (
        <p className="text-center text-sm text-gray-400 py-12">No cards yet. <Link to="/cards/apply" className="text-navy-600 underline">Apply now</Link></p>
      )}
    </div>
  );
}