import { useQuery, useMutation } from "@tanstack/react-query";
import { authApi } from "../../services/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useEffect } from "react";

export default function ProfilePage() {
  const { data: user } = useQuery({ queryKey:["me"], queryFn:()=>authApi.getMe().then((r)=>r.data) });
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (user) reset({ firstName: user.first_name, lastName: user.last_name, phone: user.phone ?? "" });
  }, [user, reset]);

  const mut = useMutation({
    mutationFn: (d: any) => authApi.updateMe(d),
    onSuccess:  () => toast.success("Profile updated"),
    onError:    () => toast.error("Update failed"),
  });

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-navy-600 flex items-center justify-center text-white font-semibold text-lg">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className={`text-xs mt-1 inline-block ${user?.kyc_status==="approved" ? "badge-green" : "badge-amber"}`}>
              KYC {user?.kyc_status}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input {...register("firstName")} className="input"/>
            </div>
            <div>
              <label className="label">Last name</label>
              <input {...register("lastName")} className="input"/>
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register("phone")} className="input"/>
          </div>
          <button onClick={handleSubmit((d)=>mut.mutate(d))} disabled={mut.isPending} className="btn-primary py-2.5 px-5 mt-2">
            {mut.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}