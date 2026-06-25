import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useState } from "react";
import { Snowflake, Sun, Trash2 } from "lucide-react";

export default function AdminCardsPage() {
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
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

  const freezeMut = useMutation({
    mutationFn: (id: string) => adminApi.freezeCard(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-card-apps"]}); toast.success("Card frozen"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed to freeze"),
  });

  const unfreezeMut = useMutation({
    mutationFn: (id: string) => adminApi.unfreezeCard(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-card-apps"]}); toast.success("Card unfrozen"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed to unfreeze"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteCard(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-card-apps"]}); toast.success("Card application deleted"); setDeleteConfirm(null); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed to delete"),
  });

  const badgeClass = (status: string) => {
    if (status === "approved") return "badge-green";
    if (status === "rejected") return "badge-red";
    return "badge-amber";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Card applications</h1>
      {apps?.map((a: any) => (
        <div key={a.id} className="card p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-gray-900 capitalize">{a.card_type} card</p>
              <p className="text-xs text-gray-400">{a.email} · Fee: ${parseFloat(a.application_fee).toFixed(2)} (waived on approval)</p>
            </div>
            <span className={badgeClass(a.status)}>
              {a.status.replace(/_/g," ")}
            </span>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {a.status === "pending" && approvingId !== a.id && (
              <>
                <button onClick={() => setApprovingId(a.id)} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">Approve</button>
                <button onClick={() => rejectMut.mutate({id:a.id,reason:"Does not meet requirements"})} className="btn-danger text-xs py-1.5 px-4">Reject</button>
              </>
            )}

            {approvingId === a.id && (
              <div className="flex gap-2 items-center">
                <input {...register("creditLimit",{valueAsNumber:true})} type="number" placeholder="Credit limit" className="input w-32 text-sm py-1.5"/>
                <input {...register("apr",{valueAsNumber:true})} type="number" step="0.0001" placeholder="APR e.g. 0.2199" className="input w-36 text-sm py-1.5"/>
                <button onClick={handleSubmit((d) => approveMut.mutate({id:a.id,...d}))} className="btn-primary text-xs py-1.5 px-4">Confirm</button>
                <button onClick={() => setApprovingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}

            {a.status === "approved" && (
              <>
                <button onClick={() => freezeMut.mutate(a.id)} disabled={freezeMut.isPending}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium border border-blue-200 rounded-md px-3 py-1.5">
                  <Snowflake size={12} /> Freeze card
                </button>
                <button onClick={() => unfreezeMut.mutate(a.id)} disabled={unfreezeMut.isPending}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium border border-amber-200 rounded-md px-3 py-1.5">
                  <Sun size={12} /> Unfreeze card
                </button>
              </>
            )}

            <button onClick={() => setDeleteConfirm(a)}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium border border-red-200 rounded-md px-3 py-1.5">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      ))}
      {!apps?.length && <div className="text-center py-12 text-gray-400"><p className="text-sm">No card applications</p></div>}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delete Card Application</h2>
                <p className="text-sm text-gray-500">This permanently removes the application and any issued card</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-5">
              <p className="font-semibold text-gray-900 capitalize">{deleteConfirm.card_type} card</p>
              <p className="text-sm text-gray-500">{deleteConfirm.email}</p>
              <p className="text-xs text-gray-400 mt-1 capitalize">Status: {deleteConfirm.status}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMut.mutate(deleteConfirm.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {deleteMut.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
