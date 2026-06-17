import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { PlusCircle, MinusCircle, X, Clock, CreditCard } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [panel, setPanel] = useState<'credit' | 'debit' | 'history' | null>(null);
  const [form, setForm] = useState({ accountId: '', amount: '', description: '', date: '' });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminApi.users(search).then((r) => r.data),
  });

  const { data: userAccounts } = useQuery({
    queryKey: ["admin-user-accounts", selectedUser?.id],
    queryFn: () => adminApi.getUserAccounts(selectedUser.id).then((r) => r.data),
    enabled: !!selectedUser,
  });

  const { data: userTxns } = useQuery({
    queryKey: ["admin-user-txns", selectedUser?.id],
    queryFn: () => adminApi.getUserTransactions(selectedUser.id).then((r) => r.data),
    enabled: !!selectedUser && panel === 'history',
  });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setUserStatus(id, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Status updated"); },
    onError: () => toast.error("Failed"),
  });

  const creditMut = useMutation({
    mutationFn: (data: any) => adminApi.creditUser(selectedUser.id, data),
    onSuccess: () => {
      toast.success("Account credited successfully");
      qc.invalidateQueries({ queryKey: ["admin-user-accounts", selectedUser?.id] });
      setForm({ accountId: '', amount: '', description: '', date: '' });
      setPanel(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Credit failed"),
  });

  const debitMut = useMutation({
    mutationFn: (data: any) => adminApi.debitUser(selectedUser.id, data),
    onSuccess: () => {
      toast.success("Account debited successfully");
      qc.invalidateQueries({ queryKey: ["admin-user-accounts", selectedUser?.id] });
      setForm({ accountId: '', amount: '', description: '', date: '' });
      setPanel(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Debit failed"),
  });

  const openPanel = (user: any, type: 'credit' | 'debit' | 'history') => {
    setSelectedUser(user);
    setPanel(type);
    setForm({ accountId: '', amount: '', description: '', date: '' });
  };

  const closePanel = () => { setSelectedUser(null); setPanel(null); };

  const handleSubmit = () => {
    if (!form.accountId || !form.amount) return toast.error("Please fill all required fields");
    if (panel === 'credit') creditMut.mutate(form);
    if (panel === 'debit') debitMut.mutate(form);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="input w-64"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {["Name", "Email", "KYC", "Status", "Actions"].map((h) => (
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => statusMut.mutate({ id: u.id, isActive: !u.is_active })}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {u.is_active ? "Suspend" : "Activate"}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => openPanel(u, 'credit')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <PlusCircle size={12} /> Credit
                    </button>
                    <button
                      onClick={() => openPanel(u, 'debit')}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <MinusCircle size={12} /> Debit
                    </button>
                    <button
                      onClick={() => openPanel(u, 'history')}
                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <Clock size={12} /> History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !users?.length && (
              <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Credit / Debit Panel */}
      {(panel === 'credit' || panel === 'debit') && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-lg font-semibold ${panel === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                  {panel === 'credit' ? 'Credit Account' : 'Debit Account'}
                </h2>
                <p className="text-sm text-gray-400">{selectedUser.first_name} {selectedUser.last_name} · {selectedUser.email}</p>
              </div>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Account selector */}
              <div>
                <label className="label">Select account</label>
                <select
                  className="input"
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">Select account</option>
                  {userAccounts?.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.account_type} ****{a.account_number?.slice(-4)} — {fmt(parseFloat(a.balance))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="label">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    className="input pl-7"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  placeholder={panel === 'credit' ? 'e.g. Account funding' : 'e.g. Fee deduction'}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Backdate */}
              <div>
                <label className="label">Transaction date (optional — for backdating)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty to use current date and time.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={creditMut.isPending || debitMut.isPending}
                  className={`flex-1 py-3 rounded-lg text-white text-sm font-medium transition-colors ${
                    panel === 'credit'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {creditMut.isPending || debitMut.isPending
                    ? 'Processing...'
                    : panel === 'credit' ? 'Credit account' : 'Debit account'
                  }
                </button>
                <button
                  onClick={closePanel}
                  className="px-5 py-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Panel */}
      {panel === 'history' && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
                <p className="text-sm text-gray-400">{selectedUser.first_name} {selectedUser.last_name} · {selectedUser.email}</p>
              </div>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Accounts summary */}
            {userAccounts?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {userAccounts.map((a: any) => (
                  <div key={a.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <CreditCard size={14} className="text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 capitalize">{a.account_type} ****{a.account_number?.slice(-4)}</p>
                      <p className="font-semibold text-gray-900 text-sm">{fmt(parseFloat(a.balance))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transactions */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Date", "Type", "Description", "Amount", "Status"].map(h => (
                    <th key={h} className="text-left pb-2 text-xs text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!userTxns?.length && (
                  <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No transactions found</td></tr>
                )}
                {userTxns?.map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.tx_type === 'credit' ? 'bg-green-100 text-green-700' :
                        t.tx_type === 'debit' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {t.tx_type}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">{t.description || '—'}</td>
                    <td className={`py-3 font-mono font-semibold ${
                      t.tx_type === 'credit' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {t.tx_type === 'credit' ? '+' : '-'}{fmt(parseFloat(t.amount))}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs ${t.status === 'completed' ? 'text-green-600' : 'text-amber-500'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
