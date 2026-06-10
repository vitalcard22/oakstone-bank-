import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data: notifs } = useQuery({ queryKey:["notifications"], queryFn:()=>api.get("/notifications").then((r)=>r.data) });
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => qc.invalidateQueries({ queryKey:["notifications"] }),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
      <div className="card divide-y divide-gray-50">
        {notifs?.map((n: any) => (
          <div key={n.id} className={`p-4 flex gap-3 ${!n.is_read ? "bg-blue-50/30" : ""}`}>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{n.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            {!n.is_read && (
              <button onClick={()=>markRead.mutate(n.id)} className="text-xs text-navy-600 hover:underline flex-shrink-0">Mark read</button>
            )}
          </div>
        ))}
        {!notifs?.length && <p className="text-sm text-gray-400 text-center py-10">No notifications</p>}
      </div>
    </div>
  );
}