import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn:  () => adminApi.users(search).then((r) => r.data),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setUserStatus(id, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Status updated"); },
    onError:   () => toast.error("Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..." className="input w-64"/>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {["Name","Email","KYC","Status","Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">Loading...</td></tr>
            )}
            {users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{u.first_name} {u.last_name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={u.kyc_status === "approved" ? "badge-green" : u.kyc_status === "rejected" ? "badge-red" : "badge-amber"}>
                    {u.kyc_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={u.is_active ? "text-green-600 text-sm" : "text-red-500 text-sm"}>
                    {u.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => statusMut.mutate({ id: u.id, isActive: !u.is_active })}
                    className="text-xs text-navy-600 hover:underline">
                    {u.is_active ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !users?.length && (
              <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}