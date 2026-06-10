import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { loanApi } from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const schema = z.object({
  loanType:        z.enum(["personal","auto","mortgage","business"]),
  requestedAmount: z.coerce.number().min(1000,"Min $1,000"),
  termMonths:      z.coerce.number().min(6).max(360),
  purpose:         z.string().min(5,"Please describe the purpose").max(300),
  annualIncome:    z.coerce.number().min(0),
});
type Form = z.infer<typeof schema>;

export default function LoanApplyPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState:{errors} } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { loanType:"personal", termMonths:36 },
  });
  const mut = useMutation({
    mutationFn: (d: Form) => loanApi.apply(d),
    onSuccess:  () => { toast.success("Application submitted!"); navigate("/loans"); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Apply for a loan</h1>
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Loan type</label>
          <select {...register("loanType")} className="input">
            <option value="personal">Personal loan</option>
            <option value="auto">Auto loan</option>
            <option value="mortgage">Mortgage</option>
            <option value="business">Business loan</option>
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input {...register("requestedAmount")} type="number" className="input pl-7" placeholder="10000"/>
          </div>
          {errors.requestedAmount && <p className="text-red-500 text-xs mt-1">{errors.requestedAmount.message}</p>}
        </div>
        <div>
          <label className="label">Term (months)</label>
          <input {...register("termMonths")} type="number" className="input" placeholder="36"/>
        </div>
        <div>
          <label className="label">Annual income</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input {...register("annualIncome")} type="number" className="input pl-7" placeholder="50000"/>
          </div>
        </div>
        <div>
          <label className="label">Purpose</label>
          <textarea {...register("purpose")} className="input h-20 resize-none" placeholder="What will you use this loan for?"/>
          {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose.message}</p>}
        </div>
        <button onClick={handleSubmit((d)=>mut.mutate(d))} disabled={mut.isPending} className="btn-primary w-full py-3">
          {mut.isPending ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </div>
  );
}