import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useState } from "react";

export default function AdminCardsPage() {
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const { data: apps } = useQuery({ queryKey:["admin-card-apps"], queryFn:()=>adminApi.cardApplications().then((r)=>r.data) });
  const { register, handleSubmit } = useForm({ defaultValues:{ creditLimit:5000, apr:0.2199 } });

  const approveMut = useMutation({
    mutationFn: ({ id, ...d }: any) => adminApi.approveCard(id, d),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-card-apps"]}); toast.success("Card approved and issued"); setApprovingId(null); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectCard(id, reason),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-card-apps"]}); toast.success("Application rejected"); },
    onError:    () => toast.error("Failed"),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Card applications</h1>
      {apps?.map((a: any) => (
        <div key={a.id} className="card p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-gray-900 capitalize">{a.card_type} card</p>
              <p className="text-xs text-gray-400">{a.email} · Fee: ${parseFloat(a.application_fee).toFixed(2)}</p>
            </div>
            <span className={a.status === "fee_paid" ? "badge-blue" : a.status === "approved" ? "badge-green" : "badge-amber"}>
              {a.status.replace(/_/g," ")}
            </span>
          </div>
          {a.status === "fee_paid" && approvingId !== a.id && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setApprovingId(a.id)} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">Approve</button>
              <button onClick={() => rejectMut.mutate({id:a.id,reason:"Does not meet requirements"})} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}
          {approvingId === a.id && (
            <div className="flex gap-2 mt-3 items-center">
              <input {...register("creditLimit",{valueAsNumber:true})} type="number" placeholder="Credit limit" className="input w-32 text-sm py-1.5"/>
              <input {...register("apr",{valueAsNumber:true})} type="number" step="0.0001" placeholder="APR e.g. 0.2199" className="input w-36 text-sm py-1.5"/>
              <button onClick={handleSubmit((d) => approveMut.mutate({id:a.id,...d}))} className="btn-primary text-xs py-1.5 px-4">Confirm</button>
              <button onClick={() => setApprovingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}
      {!apps?.length && <div className="text-center py-12 text-gray-400"><p className="text-sm">No pending applications</p></div>}
    </div>
  );
}