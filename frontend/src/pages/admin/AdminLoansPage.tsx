import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export default function AdminLoansPage() {
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string|null>(null);
  const { data: apps } = useQuery({ queryKey:["admin-loan-apps"], queryFn:()=>adminApi.loanApplications().then((r)=>r.data) });
  const { register, handleSubmit } = useForm({ defaultValues:{ interestRate:0.0799, termMonths:36 } });

  const approveMut = useMutation({
    mutationFn: ({ id, ...d }: any) => adminApi.approveLoan(id, d),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-loan-apps"]}); toast.success("Loan approved and disbursed"); setApprovingId(null); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectLoan(id, reason),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["admin-loan-apps"]}); toast.success("Loan rejected"); },
    onError:    () => toast.error("Failed"),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Loan applications</h1>
      {apps?.map((a: any) => (
        <div key={a.id} className="card p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold text-gray-900 capitalize">{a.loan_type} loan</p>
              <p className="text-xs text-gray-400">{a.email} · Requested {fmt(parseFloat(a.requested_amount))} · {a.term_months} months</p>
            </div>
            <span className={a.status === "submitted" ? "badge-blue" : a.status === "approved" ? "badge-green" : "badge-amber"}>
              {a.status}
            </span>
          </div>
          {a.purpose && <p className="text-sm text-gray-500 italic mb-3">"{a.purpose}"</p>}
          {a.status === "submitted" && approvingId !== a.id && (
            <div className="flex gap-2">
              <button onClick={() => setApprovingId(a.id)} className="btn-primary text-xs py-1.5 px-4 bg-green-600 hover:bg-green-700">Approve</button>
              <button onClick={() => rejectMut.mutate({id:a.id,reason:"Does not meet lending criteria"})} className="btn-danger text-xs py-1.5 px-4">Reject</button>
            </div>
          )}
          {approvingId === a.id && (
            <div className="flex gap-2 mt-2 items-center">
              <input {...register("interestRate",{valueAsNumber:true})} type="number" step="0.0001" placeholder="Rate e.g. 0.0799" className="input w-40 text-sm py-1.5"/>
              <input {...register("termMonths",{valueAsNumber:true})} type="number" placeholder="Months" className="input w-24 text-sm py-1.5"/>
              <button onClick={handleSubmit((d) => approveMut.mutate({id:a.id,...d}))} className="btn-primary text-xs py-1.5 px-4">Confirm</button>
              <button onClick={() => setApprovingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      ))}
      {!apps?.length && <div className="text-center py-12 text-gray-400"><p className="text-sm">No pending loan applications</p></div>}
    </div>
  );
}