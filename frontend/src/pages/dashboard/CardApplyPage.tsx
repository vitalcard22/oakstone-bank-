import { useQuery, useMutation } from "@tanstack/react-query";
import { cardApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock } from "lucide-react";

type CardType = "classic"|"gold"|"platinum";

const META: Record<CardType,{name:string;color:string;perks:string[]}> = {
  classic:  { name:"Classic Rewards", color:"from-gray-800 to-gray-600", perks:["1.5% cash back","No annual fee","Fraud protection","Virtual cards"] },
  gold:     { name:"Gold Rewards",    color:"from-yellow-700 to-yellow-500", perks:["2% back on dining","$95 annual fee","Priority support","Higher limits"] },
  platinum: { name:"Platinum Travel", color:"from-slate-900 to-slate-700", perks:["3x travel points","Lounge access","Global Entry credit","Trip insurance"] },
};

export default function CardApplyPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<CardType|null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: feeConfig } = useQuery({ queryKey:["fee-config"], queryFn:()=>cardApi.feeConfig().then((r)=>r.data) });

  const fees = feeConfig ? Object.fromEntries(feeConfig.map((f: any)=>[f.card_type,f])) : {};

  const applyMut = useMutation({
    mutationFn: (cardType: CardType) => cardApi.apply({ cardType }),
    onSuccess:  () => { setSubmitted(true); toast.success("Application submitted for review"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed to submit application"),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Apply for a credit card</h1>
        <p className="text-sm text-gray-400 mt-1">Choose a card and submit your application for review.</p>
      </div>

      {!submitted && (
        <div className="grid grid-cols-3 gap-4">
          {(Object.keys(META) as CardType[]).map((type) => {
            const meta = META[type];
            const fee  = fees[type];
            return (
              <button key={type} onClick={()=>setSelected(type)}
                className={`text-left rounded-xl overflow-hidden border-2 transition-all ${selected===type?"border-navy-600 shadow-md":"border-transparent shadow-sm hover:border-navy-200"}`}>
                <div className={`bg-gradient-to-br ${meta.color} p-5 text-white`}>
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-xs uppercase tracking-widest opacity-75">Oakstones</span>
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
      )}

      {selected && !submitted && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Confirm application</h3>
          {fees[selected]?.fee_enabled && (
            <p className="text-sm text-gray-500 mb-4">
              This card has an application fee of <span className="font-mono text-navy-600">${parseFloat(fees[selected].application_fee).toFixed(2)}</span>, set by administration. No payment is required now — your application will be reviewed first.
            </p>
          )}
          <button disabled={applyMut.isPending} onClick={()=>applyMut.mutate(selected)}
            className="btn-primary py-2.5 px-6">
            {applyMut.isPending ? "Submitting..." : "Submit application"}
          </button>
        </div>
      )}

      {submitted && (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Application submitted</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Your {selected && META[selected].name} application is now under review. Our team typically reviews
            applications within 1 business day. You'll be notified once a decision has been made — no further
            action is needed from you right now.
          </p>
          <button onClick={()=>navigate("/cards")} className="btn-primary py-2.5 px-6">
            <CheckCircle2 size={16} className="inline mr-1.5 -mt-0.5" /> Back to Cards
          </button>
        </div>
      )}
    </div>
  );
}
