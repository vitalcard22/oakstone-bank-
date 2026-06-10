import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { accountApi, txApi } from "../../services/api";
import toast from "react-hot-toast";

const schema = z.object({
  fromAccountId: z.string().uuid("Required"),
  toAccountId:   z.string().uuid("Required"),
  amount:        z.coerce.number().min(0.01,"Min $0.01"),
  description:   z.string().max(140).optional(),
});
type Form = z.infer<typeof schema>;

export default function TransferPage() {
  const { data: accounts } = useQuery({ queryKey:["accounts"], queryFn:()=>accountApi.list().then((r)=>r.data) });
  const { register, handleSubmit, reset, formState:{errors} } = useForm<Form>({ resolver: zodResolver(schema) });
  const mut = useMutation({
    mutationFn: (d: Form) => txApi.transfer(d),
    onSuccess:  () => { toast.success("Transfer completed"); reset(); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Transfer failed"),
  });

  const active = accounts?.filter((a: any) => a.status === "active") ?? [];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Internal transfer</h1>
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">From account</label>
          <select {...register("fromAccountId")} className="input">
            <option value="">Select account</option>
            {active.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ****{a.account_number?.slice(-4)} — ${parseFloat(a.balance).toFixed(2)}</option>)}
          </select>
          {errors.fromAccountId && <p className="text-red-500 text-xs mt-1">{errors.fromAccountId.message}</p>}
        </div>
        <div>
          <label className="label">To account</label>
          <select {...register("toAccountId")} className="input">
            <option value="">Select account</option>
            {active.map((a: any) => <option key={a.id} value={a.id}>{a.account_type} ****{a.account_number?.slice(-4)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input {...register("amount")} type="number" step="0.01" placeholder="0.00" className="input pl-7"/>
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input {...register("description")} className="input" placeholder="What is this for?"/>
        </div>
        <button onClick={handleSubmit((d) => mut.mutate(d))} disabled={mut.isPending} className="btn-primary w-full py-3">
          {mut.isPending ? "Processing..." : "Transfer funds"}
        </button>
      </div>
    </div>
  );
}