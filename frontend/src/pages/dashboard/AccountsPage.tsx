import { useQuery } from "@tanstack/react-query";
import { accountApi } from "../../services/api";
import { Link } from "react-router-dom";

const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn:  () => accountApi.list().then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">My accounts</h1>
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      <div className="grid gap-4">
        {accounts?.map((a: any) => (
          <Link key={a.id} to={`/accounts/${a.id}`} className="card p-5 hover:shadow-md transition-shadow block">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide capitalize">{a.account_type}</p>
                <p className="font-mono text-xs text-gray-400 mt-0.5">****{a.account_number?.slice(-4)} · Routing {a.routing_number}</p>
              </div>
              <span className={a.status === "active" ? "badge-green" : "badge-gray"}>{a.status}</span>
            </div>
            <p className="text-3xl font-mono font-semibold text-navy-600 mt-3">{fmt(parseFloat(a.balance))}</p>
            <p className="text-xs text-gray-400 mt-1">Available: {fmt(parseFloat(a.available_balance))}</p>
          </Link>
        ))}
        {!isLoading && !accounts?.length && (
          <p className="text-center text-sm text-gray-400 py-12">No accounts yet.</p>
        )}
      </div>
    </div>
  );
}