import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useState, useCallback } from "react";

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<any[]>([]);

  useWebSocket({
    transaction:  useCallback((d: any) => setEvents((p) => [{ ...d, _type:"tx" },    ...p].slice(0,40)), []),
    fraud_alert:  useCallback((d: any) => setEvents((p) => [{ ...d, _type:"fraud" }, ...p].slice(0,40)), []),
  });

  const { data: stats } = useQuery({
    queryKey:      ["admin-dashboard"],
    queryFn:       () => adminApi.dashboard().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const metrics = [
    { label:"Total customers",    value: stats?.totalUsers      ?? "—" },
    { label:"Active accounts",    value: stats?.activeAccounts  ?? "—" },
    { label:"Today volume",       value: stats?.todayVolume ? `$${stats.todayVolume}` : "—" },
    { label:"Open fraud alerts",  value: stats?.openFraudAlerts ?? "—" },
    { label:"KYC pending",        value: stats?.kycPending      ?? "—" },
    { label:"Card apps pending",  value: stats?.pendingCardApps ?? "—" },
    { label:"Loan apps pending",  value: stats?.pendingLoanApps ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Admin dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card px-4 py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{m.label}</p>
            <p className="text-2xl font-mono font-semibold text-navy-600 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          <h2 className="font-semibold text-gray-900">Live activity stream</h2>
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {events.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Waiting for events...</p>
          )}
          {events.map((e, i) => (
            <div key={i} className={`px-5 py-3 flex justify-between items-center text-sm ${e._type === "fraud" ? "bg-red-50" : ""}`}>
              <span className={`capitalize ${e._type === "fraud" ? "text-red-700 font-medium" : "text-gray-700"}`}>
                {e._type === "fraud" ? "🚨 " : ""}{e.type?.replace(/_/g, " ") ?? e._type}
              </span>
              <span className="text-xs text-gray-400">{new Date().toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}