import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../services/api";

export default function AdminAuditPage() {
  const { data: log } = useQuery({ queryKey:["audit-log"], queryFn:()=>adminApi.auditLog().then((r)=>r.data) });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {["Action","Actor","IP","Time"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {log?.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-navy-600">{e.action}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{e.email ?? e.actor_id?.slice(0,8)+"..."}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.ip_address ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!log?.length && (
              <tr><td colSpan={4} className="text-center py-8 text-sm text-gray-400">No audit entries</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}