import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import toast from "react-hot-toast";

const SEV: Record<string,string> = {
  critical:"bg-red-100 text-red-800",
  high:"bg-orange-50 text-orange-700",
  medium:"bg-amber-50 text-amber-700",
  low:"bg-yellow-50 text-yellow-700",
};

export default function AdminFraudPage() {
  const qc = useQueryClient();

  const { data: alerts } = useQuery({
    queryKey:      ["fraud-alerts"],
    queryFn:       () => adminApi.fraudAlerts().then((r) => r.data),
    refetchInterval: 10_000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => adminApi.resolveFraud(id),
    onSuccess:  () => { qc.invalidateQueries({queryKey:["fraud-alerts"]}); toast.success("Alert resolved"); },
    onError:    () => toast.error("Failed"),
  });

  const open = alerts?.filter((a: any) => !a.is_resolved).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
        <h1 className="text-xl font-semibold text-gray-900">Fraud monitoring</h1>
        {open > 0 && <span className="badge-red">{open} open</span>}
      </div>

      {alerts?.map((a: any) => (
        <div key={a.id} className={`card p-5 ${!a.is_resolved ? "border-red-100" : ""}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV[a.severity] ?? "badge-gray"}`}>
                  {a.severity}
                </span>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {a.rule_triggered?.split(",").join(", ")}
                </p>
              </div>
              <p className="text-xs text-gray-400">{a.email} · Risk score: {a.risk_score} · {new Date(a.created_at).toLocaleString()}</p>
            </div>
            <div>
              {!a.is_resolved ? (
                <button onClick={() => resolveMut.mutate(a.id)} disabled={resolveMut.isPending}
                  className="btn-primary text-xs py-1.5 px-3">
                  Resolve
                </button>
              ) : (
                <span className="text-xs text-green-600 font-medium">Resolved</span>
              )}
            </div>
          </div>
          {a.details && Object.keys(a.details).length > 0 && (
            <pre className="text-xs bg-gray-50 rounded-md p-2 overflow-x-auto mt-2 text-gray-600">
              {JSON.stringify(a.details, null, 2)}
            </pre>
          )}
        </div>
      ))}

      {!alerts?.length && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No fraud alerts</p>
        </div>
      )}
    </div>
  );
}