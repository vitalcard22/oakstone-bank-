import { useQuery, useMutation } from "@tanstack/react-query";
import { cardApi, accountApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

type CardType = "classic"|"gold"|"platinum";

const META: Record<CardType,{name:string;color:string;perks:string[]}> = {
  classic:  { name:"Classic Rewards", color:"from-gray-800 to-gray-600", perks:["1.5% cash back","No annual fee","Fraud protection","Virtual cards"] },
  gold:     { name:"Gold Rewards",    color:"from-yellow-700 to-yellow-500", perks:["2% back on dining","$95 annual fee","Priority support","Higher limits"] },
  platinum: { name:"Platinum Travel", color:"from-slate-900 to-slate-700", perks:["3x travel points","Lounge access","Global Entry credit","Trip insurance"] },
};

export default function CardApplyPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<CardType|null>(null);
  const [payAcct,  setPayAcct ] = useState("");
  const [appId,    setAppId   ] = useState<string|null>(null);

  const { data: feeConfig } = useQuery({ queryKey:["fee-config"], queryFn:()=>cardApi.feeConfig().then((r)=>r.data) });
  const { data: accounts  } = useQuery({ queryKey:["accounts"],   queryFn:()=>accountApi.list().then((r)=>r.data) });

  const fees = feeConfig ? Object.fromEntries(feeConfig.map((f: any)=>[f.card_type,f])) : {};

  const applyMut = useMutation({
    mutationFn: (cardType: CardType) => cardApi.apply({ cardType }),
    onSuccess:  (res) => { setAppId(res.data.applicationId); toast.success("Application created — pay the fee to continue"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const feeMut = useMutation({
    mutationFn: ({ id, accountId }: { id:string; accountId:string }) => cardApi.payFee(id, { paymentAccountId: accountId }),
    onSuccess:  () => { toast.success("Fee paid — application under review!"); navigate("/cards"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Payment failed"),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Apply for a credit card</h1>
        <p className="text-sm text-gray-400 mt-1">All applications require an admin-set fee before review begins.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(META) as CardType[]).map((type) => {
          const meta = META[type];
          const fee  = fees[type];
          return (
            <button key={type} onClick={()=>setSelected(type)}
              className={`text-left rounded-xl overflow-hidden border-2 transition-all ${selected===type?"border-navy-600 shadow-md":"border-transparent shadow-sm hover:border-navy-200"}`}>
              <div className={`bg-gradient-to-br ${meta.color} p-5 text-white`}>
                <div className="flex justify-between items-start mb-8">
                  <span className="text-xs uppercase tracking-widest opacity-75">Oakstone</span>
                  <span className="text-xs font-mono opacity-75">VISA</span>
                </div>
                <p className="font-mono text-xs opacity-75 mb-1">**** **** **** ****</p>
                <p className="font-semibold text-sm">{meta.name}</p>
              </div>
              <div className="bg-white p-4">
                {fee?.fee_enabled && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-2 mb-3 text-center">
                    <p className="text-xs text-amber-700">Application fee</p>
                    <p className="text-lg font-mono font-bold text-amber-800">${parseFloat(fee.application_fee).toFixed(2)}</p>
                  </div>
                )}
                <ul className="space-y-1">
                  {meta.perks.map((p)=><li key={p} className="text-xs text-gray-600 flex gap-1.5"><span className="text-green-500">✓</span>{p}</li>)}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      {selected && !appId && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Confirm application</h3>
          {fees[selected]?.fee_enabled && (
            <p className="text-sm text-gray-500 mb-4">
              A non-refundable application fee of <span className="font-mono text-navy-600">${parseFloat(fees[selected].application_fee).toFixed(2)}</span> is required to proceed. This fee is set by administration.
            </p>
          )}
          <button disabled={applyMut.isPending} onClick={()=>applyMut.mutate(selected)}
            className="btn-primary py-2.5 px-6">
            {applyMut.isPending ? "Submitting..." : "Submit application"}
          </button>
        </div>
      )}

      {appId && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Pay application fee</h3>
          <div className="mb-4">
            <label className="label">Pay from account</label>
            <select value={payAcct} onChange={(e)=>setPayAcct(e.target.value)} className="input">
              <option value="">Select account</option>
              {accounts?.filter((a: any)=>a.status==="active").map((a: any)=>(
                <option key={a.id} value={a.id}>{a.account_type} ****{a.account_number?.slice(-4)} — ${parseFloat(a.balance).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <button disabled={!payAcct||feeMut.isPending} onClick={()=>feeMut.mutate({id:appId,accountId:payAcct})}
            className="btn-primary py-2.5 px-6">
            {feeMut.isPending ? "Processing..." : "Pay fee & submit"}
          </button>
        </div>
      )}
    </div>
  );
}