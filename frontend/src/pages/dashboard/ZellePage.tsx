import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { accountApi, txApi } from "../../services/api";
import toast from "react-hot-toast";

const schema = z.object({
  fromAccountId: z.string().uuid("Required"),
  identifier:    z.string().min(3,"Enter email or phone"),
  amount:        z.coerce.number().min(1,"Min $1").max(2500,"Max $2,500"),
  note:          z.string().max(100).optional(),
});
type Form = z.infer<typeof schema>;

export default function ZellePage() {
  const { data: accounts } = useQuery({ queryKey:["accounts"], queryFn:()=>accountApi.list().then((r)=>r.data) });
  const { register, handleSubmit, reset, formState:{errors} } = useForm<Form>({ resolver: zodResolver(schema) });
  const mut = useMutation({
    mutationFn: (d: Form) => txApi.zelle(d),
    onSuccess:  () => { toast.success("Payment sent!"); reset(); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Payment failed"),
  });

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Send money instantly</h1>
        <p className="text-sm text-gray-400 mt-1">Send to any Oakstone customer by email or phone. Free & instant.</p>
      </div>
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">From account</label>
          <select {...register("fromAccountId")} className="input">
            <option value="">Select account</option>
            {accounts?.filter((a: any)=>a.status==="active").map((a: any)=>(
              <option key={a.id} value={a.id}>{a.account_type} ****{a.account_number?.slice(-4)} — ${parseFloat(a.balance).toFixed(2)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Recipient email or phone</label>
          <input {...register("identifier")} className="input" placeholder="name@email.com or +1 555..."/>
          {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>}
        </div>
        <div>
          <label className="label">Amount (max $2,500)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input {...register("amount")} type="number" step="0.01" placeholder="0.00" className="input pl-7"/>
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input {...register("note")} className="input" placeholder="Coffee, rent, etc."/>
        </div>
        <button onClick={handleSubmit((d)=>mut.mutate(d))} disabled={mut.isPending} className="btn-primary w-full py-3">
          {mut.isPending ? "Sending..." : "Send now"}
        </button>
      </div>
    </div>
  );
}