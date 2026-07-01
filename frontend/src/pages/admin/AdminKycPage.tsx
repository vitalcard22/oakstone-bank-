import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value && String(value).trim() ? value : "—"}</p>
    </div>
  );
}

export default function AdminKycPage() {
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data: queue } = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: () => adminApi.kycQueue().then((r) => r.data),
    refetchInterval: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: (uid: string) => adminApi.approveKyc(uid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kyc-queue"] }); toast.success("KYC approved"); },
    onError: () => toast.error("Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ uid, reason }: { uid: string; reason: string }) => adminApi.rejectKyc(uid, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kyc-queue"] }); toast.success("KYC rejected"); },
    onError: () => toast.error("Failed"),
  });

  const fmtDate = (d?: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">KYC review queue</h1>
        <span className="badge-amber">{queue?.length ?? 0} pending</span>
      </div>

      {queue?.map((u: any) => {
        const addr = [u.address_street, u.address_unit, u.address_city && `${u.address_city},`, u.address_state, u.address_zip]
          .filter(Boolean).join(" ");
        const isOpen = open[u.user_id];
        return (
          <div key={u.user_id} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-gray-900">{u.first_name} {u.middle_name ? u.middle_name + " " : ""}{u.last_name}</p>
                <p className="text-sm text-gray-400">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                <p className="text-xs text-gray-400 mt-0.5">Submitted {fmtDate(u.created_at)}</p>
              </div>
              <span className="badge-amber capitalize">{u.status ?? u.kyc_status}</span>
            </div>

            <button
              onClick={() => setOpen((p) => ({ ...p, [u.user_id]: !p[u.user_id] }))}
              className="text-xs text-navy-600 hover:underline mb-3"
            >
              {isOpen ? "▲ Hide application details" : "▼ View application details"}
            </button>

            {isOpen && (
              <div className="mb-3">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-3 flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                    {u.selfie_data
                      ? <img src={u.selfie_data} alt="Applicant selfie" className="w-full h-full object-cover" />
                      : <span className="text-xs text-gray-400 text-center px-2">No selfie</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Selfie verification</p>
                    <p className="text-sm text-gray-600 mt-1">{u.selfie_data ? "Compare this photo against the ID details below before approving." : "No selfie was submitted with this application."}</p>
                  </div>
                </div>
                {(u.id_front_data || u.id_back_data) && (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">ID document</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Front</p>
                        {u.id_front_data
                          ? <a href={u.id_front_data} target="_blank" rel="noreferrer"><img src={u.id_front_data} alt="ID front" className="w-full rounded border border-gray-200 object-cover" /></a>
                          : <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded">Not provided</div>}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Back</p>
                        {u.id_back_data
                          ? <a href={u.id_back_data} target="_blank" rel="noreferrer"><img src={u.id_back_data} alt="ID back" className="w-full rounded border border-gray-200 object-cover" /></a>
                          : <div className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded">Not provided</div>}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Tap an image to open full size.</p>
                  </div>
                )}
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Date of birth" value={fmtDate(u.date_of_birth)} />
                <Field label="SSN (last 4)" value={u.ssn_last4 ? `••• •• ${u.ssn_last4}` : "—"} />
                <Field label="Citizenship" value={u.citizenship ?? u.nationality} />
                <div className="col-span-2 md:col-span-3">
                  <Field label="Residential address" value={addr || (u.address_line1 ? [u.address_line1, u.address_line2, u.city, u.state].filter(Boolean).join(", ") : "—")} />
                </div>
                <Field label="ID type" value={u.id_type} />
                <Field label="ID (last 4)" value={u.id_last4 ?? (u.id_number ? `•••• ${u.id_number}` : "—")} />
                <Field label="ID issuing state" value={u.id_state} />
                <Field label="Employment" value={u.employment_status} />
                <Field label="Source of funds" value={u.source_of_funds} />
                <Field label="Account requested" value={u.account_type_requested} />
              </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => approveMut.mutate(u.user_id)} disabled={approveMut.isPending}
                className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">
                Approve
              </button>
              <input
                value={reasons[u.user_id] ?? ""}
                onChange={(e) => setReasons((p) => ({ ...p, [u.user_id]: e.target.value }))}
                placeholder="Rejection reason..."
                className="input flex-1 text-xs py-1.5"
              />
              <button
                onClick={() => rejectMut.mutate({ uid: u.user_id, reason: reasons[u.user_id] ?? "Incomplete documents" })}
                disabled={rejectMut.isPending}
                className="btn-danger text-xs py-1.5 px-4">
                Reject
              </button>
            </div>
          </div>
        );
      })}

      {!queue?.length && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">KYC queue is empty</p>
        </div>
      )}
    </div>
  );
}
