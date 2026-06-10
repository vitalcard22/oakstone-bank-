import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useState } from "react";

const schema = z.object({
  applicationFee: z.coerce.number().min(0),
  feeEnabled:     z.boolean(),
});
type FeeForm = z.infer<typeof schema>;

const NAMES: Record<string, string> = {
  classic:"Classic Rewards", gold:"Gold Rewards", platinum:"Platinum Travel",
};

function FeeEditor({ config, onSave }: { config: any; onSave: (t: string, d: FeeForm) => void }) {
  const { register, handleSubmit } = useForm<FeeForm>({
    resolver: zodResolver(schema),
    defaultValues: { applicationFee: config.application_fee, feeEnabled: config.fee_enabled },
  });
  return (
    <form onSubmit={handleSubmit((d) => onSave(config.card_type, d))} className="space-y-3 mt-3">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 w-28">Application fee</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input {...register("applicationFee")} type="number" step="0.01" className="input pl-6 w-28 text-sm py-2"/>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600 w-28">Fee enabled</label>
        <input {...register("feeEnabled")} type="checkbox" className="w-4 h-4 accent-navy-600"/>
      </div>
      <button type="submit" className="btn-primary text-xs py-1.5 px-4">Save</button>
    </form>
  );
}

export default function AdminCardFeesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data: fees } = useQuery({ queryKey:["admin-card-fees"], queryFn:()=>adminApi.cardFees().then((r)=>r.data) });

  const updateMut = useMutation({
    mutationFn: ({ type, data }: { type: string; data: FeeForm }) => adminApi.updateCardFee(type, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:["admin-card-fees"] }); toast.success("Fee updated"); setEditing(null); },
    onError:    () => toast.error("Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Credit card fee management</h1>
        <p className="text-sm text-gray-400 mt-1">Application fees are set exclusively by admins. Customers cannot apply without paying the configured fee.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-amber-500 text-lg">⚠</span>
        <div>
          <p className="text-sm font-medium text-amber-800">Fee rule</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Every credit card application requires fee payment before entering review. Applications with status <span className="font-mono bg-amber-100 px-1 rounded">pending_fee</span> are blocked until payment is confirmed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {fees?.map((c: any) => (
          <div key={c.card_type} className="card p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{NAMES[c.card_type]}</h3>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{c.card_type} tier</p>
              </div>
              <span className={c.fee_enabled ? "badge-green" : "badge-gray"}>
                {c.fee_enabled ? "Fee active" : "Fee waived"}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Application fee</span>
                <span className="font-mono font-semibold text-navy-600">${parseFloat(c.application_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Annual fee</span>
                <span className="font-mono">${parseFloat(c.annual_fee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">APR range</span>
                <span className="font-mono text-xs">
                  {(parseFloat(c.apr_min)*100).toFixed(2)}% – {(parseFloat(c.apr_max)*100).toFixed(2)}%
                </span>
              </div>
            </div>
            {editing === c.card_type ? (
              <FeeEditor config={c} onSave={(type, data) => updateMut.mutate({ type, data })}/>
            ) : (
              <button onClick={() => setEditing(c.card_type)}
                className="text-xs text-navy-600 border border-navy-200 px-4 py-1.5 rounded-md hover:bg-navy-50 transition-colors">
                Edit fee
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}