import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../services/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { PlusCircle, MinusCircle, X, Clock, CreditCard, Hash, UserPlus, Trash2 } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const EMPTY_FORM = {
  accountId: '',
  amount: '',
  description: '',
  date: '',
  senderName: '',
  recipientName: '',
  bankName: '',
  routingNumber: '',
  externalAccountNumber: '',
  transactionType: 'credit',
  reference: '',
  notes: '',
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [panel, setPanel] = useState<'credit' | 'debit' | 'history' | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminApi.users(search).then((r) => r.data),
  });

  const { data: userAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["admin-user-accounts", selectedUser?.id],
    queryFn: () => adminApi.getUserAccounts(selectedUser.id).then((r) => r.data),
    enabled: !!selectedUser,
  });

  const { data: userTxns, isLoading: txnLoading } = useQuery({
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

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success("User deleted successfully");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Delete failed"),
  });

  const createAccountMut = useMutation({
    mutationFn: () => adminApi.createUserAccount(selectedUser.id),
    onSuccess: () => {
      toast.success("Account created successfully");
      qc.invalidateQueries({ queryKey: ["admin-user-accounts", selectedUser?.id] });
      refetchAccounts();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to create account"),
  });

  const creditMut = useMutation({
    mutationFn: (data: any) => adminApi.creditUser(selectedUser.id, data),
    onSuccess: () => {
      toast.success("Account credited successfully");
      qc.invalidateQueries({ queryKey: ["admin-user-accounts", selectedUser?.id] });
      qc.invalidateQueries({ queryKey: ["admin-user-txns", selectedUser?.id] });
      setForm({ ...EMPTY_FORM });
      setPanel(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Credit failed"),
  });

  const debitMut = useMutation({
    mutationFn: (data: any) => adminApi.debitUser(selectedUser.id, data),
    onSuccess: () => {
      toast.success("Account debited successfully");
      qc.invalidateQueries({ queryKey: ["admin-user-accounts", selectedUser?.id] });
      qc.invalidateQueries({ queryKey: ["admin-user-txns", selectedUser?.id] });
      setForm({ ...EMPTY_FORM });
      setPanel(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Debit failed"),
  });

  const openPanel = (user: any, type: 'credit' | 'debit' | 'history') => {
    setSelectedUser(user);
    setPanel(type);
    setForm({ ...EMPTY_FORM });
  };

  const closePanel = () => { setSelectedUser(null); setPanel(null); };

  const handleSubmit = () => {
    if (!form.accountId) return toast.error("Please select an account");
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("Please enter a valid amount");
    if (panel === 'credit') creditMut.mutate(form);
    if (panel === 'debit') debitMut.mutate(form);
  };

  const isPending = creditMut.isPending || debitMut.isPending;
  const hasNoAccounts = userAccounts !== undefined && userAccounts.length === 0;

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
                  <div className="flex items-center gap-3">
                    <button onClick={() => statusMut.mutate({ id: u.id, isActive: !u.is_active })}
                      className="text-xs text-gray-500 hover:text-gray-700 underline">
                      {u.is_active ? "Suspend" : "Activate"}
                    </button>
                    <span className="text-gray-200">|</span>
                    <button onClick={() => openPanel(u, 'credit')}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium">
                      <PlusCircle size={12} /> Credit
                    </button>
                    <button onClick={() => openPanel(u, 'debit')}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium">
                      <MinusCircle size={12} /> Debit
                    </button>
                    <button onClick={() => openPanel(u, 'history')}
                      className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium">
                      <Clock size={12} /> History
                    </button>
                    <button onClick={() => setDeleteConfirm(u)}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 font-medium">
                      <Trash2 size={12} /> Delete
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delete User</h2>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              You are about to permanently delete:
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-5">
              <p className="font-semibold text-gray-900">{deleteConfirm.first_name} {deleteConfirm.last_name}</p>
              <p className="text-sm text-gray-500">{deleteConfirm.email}</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">All accounts, transactions, and data for this user will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMut.mutate(deleteConfirm.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {deleteMut.isPending ? 'Deleting...' : 'Yes, Delete User'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit / Debit Panel */}
      {(panel === 'credit' || panel === 'debit') && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className={`p-6 rounded-t-2xl ${panel === 'credit' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{panel === 'credit' ? 'Credit Account' : 'Debit Account'}</h2>
                  <p className="text-sm opacity-80 mt-0.5">{selectedUser.first_name} {selectedUser.last_name} Â· {selectedUser.email}</p>
                </div>
                <button onClick={closePanel} className="text-white/70 hover:text-white"><X size={22} /></button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {hasNoAccounts && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <UserPlus size={28} className="mx-auto mb-2 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-800 mb-1">No bank account found</p>
                  <p className="text-xs text-amber-600 mb-3">This user has no Oakstones account yet. Create one to proceed.</p>
                  <button
                    onClick={() => createAccountMut.mutate()}
                    disabled={createAccountMut.isPending}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                    {createAccountMut.isPending ? 'Creating...' : '+ Create Checking Account'}
                  </button>
                </div>
              )}

              <div>
                <label className="label">Oakstones Account *</label>
                <select className="input" value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">Select account</option>
                  {userAccounts?.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.account_type.charAt(0).toUpperCase() + a.account_type.slice(1)} Account
                      â€” No. {a.account_number}
                      â€” Balance: {fmt(parseFloat(a.balance || 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  {panel === 'credit' ? 'Sender Name *' : 'Recipient Name *'}
                </label>
                <input
                  className="input"
                  placeholder={panel === 'credit' ? 'e.g. John Smith, Acme Corp' : 'e.g. Jane Doe, Utility Company'}
                  value={panel === 'credit' ? form.senderName : form.recipientName}
                  onChange={e => setForm(f => ({
                    ...f,
                    ...(panel === 'credit' ? { senderName: e.target.value } : { recipientName: e.target.value })
                  }))}
                />
              </div>

              <div>
                <label className="label">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input type="number" className="input pl-7 text-lg font-semibold" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    min="0.01" step="0.01" />
                </div>
              </div>

              <div>
                <label className="label">Transaction Description *</label>
                <input className="input" placeholder={panel === 'credit' ? 'e.g. Account funding, Salary payment, Refund' : 'e.g. Fee deduction, Withdrawal, Charge'}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  {panel === 'credit' ? 'Source Bank Details (optional)' : 'Destination Bank Details (optional)'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Bank Name</label>
                    <input className="input" placeholder="e.g. Chase Bank, Wells Fargo"
                      value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Transfer Method</label>
                    <select className="input" value={form.transactionType}
                      onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}>
                      <option value="credit">Direct Credit</option>
                      <option value="wire">Wire Transfer</option>
                      <option value="ach">ACH Transfer</option>
                      <option value="zelle">Zelle</option>
                      <option value="check">Check Deposit</option>
                      <option value="cash">Cash Deposit</option>
                      <option value="internal">Internal Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Routing Number</label>
                    <input className="input" placeholder="9-digit routing number"
                      value={form.routingNumber} onChange={e => setForm(f => ({ ...f, routingNumber: e.target.value }))}
                      maxLength={9} />
                  </div>
                  <div>
                    <label className="label">External Account Number</label>
                    <input className="input" placeholder="Account number"
                      value={form.externalAccountNumber} onChange={e => setForm(f => ({ ...f, externalAccountNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Reference / Memo</label>
                    <input className="input" placeholder="e.g. INV-2024-001"
                      value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Transaction Date (backdating)</label>
                    <input type="datetime-local" className="input"
                      value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Leave empty for current date/time.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="label">Admin Notes (internal only)</label>
                  <textarea className="input resize-none h-20" placeholder="Internal notes â€” not visible to the customer..."
                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {form.accountId && form.amount && (
                <div className={`rounded-xl p-4 ${panel === 'credit' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-400">Account:</span> <span className="font-medium">{userAccounts?.find((a: any) => a.id === form.accountId)?.account_number}</span></div>
                    <div><span className="text-gray-400">Amount:</span> <span className={`font-bold ${panel === 'credit' ? 'text-green-700' : 'text-red-600'}`}>{panel === 'credit' ? '+' : '-'}{fmt(parseFloat(form.amount || '0'))}</span></div>
                    {panel === 'credit' && form.senderName && <div><span className="text-gray-400">From:</span> <span className="font-medium">{form.senderName}</span></div>}
                    {panel === 'debit' && form.recipientName && <div><span className="text-gray-400">To:</span> <span className="font-medium">{form.recipientName}</span></div>}
                    {form.bankName && <div><span className="text-gray-400">Bank:</span> <span className="font-medium">{form.bankName}</span></div>}
                    {form.transactionType && <div><span className="text-gray-400">Method:</span> <span className="font-medium capitalize">{form.transactionType}</span></div>}
                    {form.date && <div><span className="text-gray-400">Date:</span> <span className="font-medium">{new Date(form.date).toLocaleDateString()}</span></div>}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmit} disabled={isPending || hasNoAccounts}
                  className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors ${
                    panel === 'credit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-60`}>
                  {isPending ? 'Processing...' : panel === 'credit' ? 'âœ“ Confirm Credit' : 'âœ“ Confirm Debit'}
                </button>
                <button onClick={closePanel}
                  className="px-6 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Panel */}
      {panel === 'history' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-emerald-800 p-6 rounded-t-2xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Transaction History</h2>
                  <p className="text-sm opacity-80 mt-0.5">{selectedUser.first_name} {selectedUser.last_name} Â· {selectedUser.email}</p>
                </div>
                <button onClick={closePanel} className="text-white/70 hover:text-white"><X size={22} /></button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {userAccounts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Accounts</p>
                  <div className="grid grid-cols-3 gap-3">
                    {userAccounts.map((a: any) => (
                      <div key={a.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard size={14} className="text-emerald-600" />
                          <span className="text-xs font-medium text-gray-500 capitalize">{a.account_type}</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{fmt(parseFloat(a.balance || 0))}</p>
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Hash size={10} /> <span className="font-mono">{a.account_number}</span>
                          </p>
                          <p className="text-xs text-gray-400">Available: {fmt(parseFloat(a.available_balance || 0))}</p>
                          <p className="text-xs text-gray-400">Status: <span className={a.status === 'active' ? 'text-green-600 font-medium' : 'text-red-500'}>{a.status}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Transactions (last 50)</p>
                {txnLoading && <p className="text-center py-8 text-sm text-gray-400">Loading transactions...</p>}
                {!txnLoading && !userTxns?.length && (
                  <div className="text-center py-12 text-gray-400">
                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No transactions found</p>
                  </div>
                )}
                {userTxns?.length > 0 && (
                  <div className="space-y-2">
                    {userTxns.map((t: any) => {
                      const meta = t.metadata ? (typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata) : {};
                      return (
                        <div key={t.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                                t.tx_type === 'credit' ? 'bg-green-100 text-green-700' :
                                t.tx_type === 'debit' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {t.tx_type === 'credit' ? '+' : t.tx_type === 'debit' ? 'âˆ’' : 'â†”'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{t.description || 'Transaction'}</p>
                                <p className="text-xs text-gray-400">
                                  {new Date(t.created_at).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${t.tx_type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                                {t.tx_type === 'credit' ? '+' : 'âˆ’'}{fmt(parseFloat(t.amount))}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
                            <div>
                              <p className="text-gray-400 mb-0.5">Reference ID</p>
                              <p className="font-mono font-medium text-gray-700 truncate">{t.reference_id || 'â€”'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5">Type</p>
                              <p className="font-medium text-gray-700 capitalize">{t.tx_type}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5">Method</p>
                              <p className="font-medium text-gray-700 capitalize">{meta.transactionType || t.tx_type || 'â€”'}</p>
                            </div>
                            {(meta.senderName || meta.recipientName) && (
                              <div>
                                <p className="text-gray-400 mb-0.5">{meta.senderName ? 'From' : 'To'}</p>
                                <p className="font-medium text-gray-700">{meta.senderName || meta.recipientName}</p>
                              </div>
                            )}
                            {meta.bankName && (
                              <div>
                                <p className="text-gray-400 mb-0.5">Bank Name</p>
                                <p className="font-medium text-gray-700">{meta.bankName}</p>
                              </div>
                            )}
                            {meta.routingNumber && (
                              <div>
                                <p className="text-gray-400 mb-0.5">Routing Number</p>
                                <p className="font-mono font-medium text-gray-700">{meta.routingNumber}</p>
                              </div>
                            )}
                            {meta.externalAccountNumber && (
                              <div>
                                <p className="text-gray-400 mb-0.5">Ext. Account No.</p>
                                <p className="font-mono font-medium text-gray-700">****{meta.externalAccountNumber?.slice(-4)}</p>
                              </div>
                            )}
                            {meta.reference && (
                              <div>
                                <p className="text-gray-400 mb-0.5">Memo / Reference</p>
                                <p className="font-medium text-gray-700">{meta.reference}</p>
                              </div>
                            )}
                            {meta.notes && (
                              <div className="col-span-3">
                                <p className="text-gray-400 mb-0.5">Admin Notes</p>
                                <p className="font-medium text-gray-600 italic">{meta.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
