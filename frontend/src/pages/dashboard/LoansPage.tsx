import { useQuery } from "@tanstack/react-query";
import { loanApi } from "../../services/api";
import { Link } from "react-router-dom";

const fmt = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export default function LoansPage() {
  const { data: loans } = useQuery({ queryKey:["loans"], queryFn:()=>loanApi.list().then((r)=>r.data) });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">My loans</h1>
        <Link to="/loans/apply" className="btn-primary px-4 py-2 text-sm inline-block">Apply for a loan</Link>
      </div>
      {loans?.map((l: any) => (
        <div key={l.id} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-semibold text-gray-900 capitalize">{l.loan_type} loan</p>
              <p className="text-xs text-gray-400 capitalize">{l.status}</p>
            </div>
            <p className="font-mono font-bold text-navy-600">{fmt(parseFloat(l.outstanding_balance))}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-md p-2">
              <p className="text-xs text-gray-400">Monthly</p>
              <p className="font-mono text-sm">{fmt(parseFloat(l.monthly_payment))}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-2">
              <p className="text-xs text-gray-400">Rate</p>
              <p className="font-mono text-sm">{(parseFloat(l.interest_rate)*100).toFixed(2)}%</p>
            </div>
            <div className="bg-gray-50 rounded-md p-2">
              <p className="text-xs text-gray-400">Term</p>
              <p className="font-mono text-sm">{l.term_months}mo</p>
            </div>
          </div>
        </div>
      ))}
      {!loans?.length && <p className="text-center text-sm text-gray-400 py-12">No active loans.</p>}
    </div>
  );
}