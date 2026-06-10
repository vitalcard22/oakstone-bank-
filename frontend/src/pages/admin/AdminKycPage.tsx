import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";

export default function AdminKycPage() {
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: queue } = useQuery({
    queryKey:      ["kyc-queue"],
    queryFn:       () => adminApi.kycQueue().then((r) => r.data),
    refetchInterval: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: (uid: string) => adminApi.approveKyc(uid),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["kyc-queue"] }); toast.success("KYC approved"); },
    onError:    () => toast.error("Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ uid, reason }: { uid: string; reason: string }) => adminApi.rejectKyc(uid, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["kyc-queue"] }); toast.success("KYC rejected"); },
    onError:    () => toast.error("Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">KYC review queue</h1>
        <span className="badge-amber">{queue?.length ?? 0} pending</span>
      </div>

      {queue?.map((u: any) => (
        <div key={u.id} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-semibold text-gray-900">{u.first_name} {u.last_name}</p>
              <p className="text-sm text-gray-400">{u.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Submitted {new Date(u.created_at).toLocaleDateString()}</p>
            </div>
            <span className="badge-amber capitalize">{u.kyc_status}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => approveMut.mutate(u.id)} disabled={approveMut.isPending}
              className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">
              Approve
            </button>
            <input
              value={reasons[u.id] ?? ""}
              onChange={(e) => setReasons((p) => ({ ...p, [u.id]: e.target.value }))}
              placeholder="Rejection reason..."
              className="input flex-1 text-xs py-1.5"
            />
            <button
              onClick={() => rejectMut.mutate({ uid: u.id, reason: reasons[u.id] ?? "Incomplete documents" })}
              disabled={rejectMut.isPending}
              className="btn-danger text-xs py-1.5 px-4">
              Reject
            </button>
          </div>
        </div>
      ))}

      {!queue?.length && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">KYC queue is empty</p>
        </div>
      )}
    </div>
  );
}