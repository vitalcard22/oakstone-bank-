import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../services/api";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COUNTRIES } from "../../utils/countries";

// Resize an image File to a compact JPEG data URL, same approach as the KYC selfie capture.
function fileToDataUrl(file: File, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => authApi.getMe().then((r) => r.data) });
  const { register, handleSubmit, reset } = useForm();
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    if (user) {
      reset({ firstName: user.first_name, lastName: user.last_name, phone: user.phone ?? "" });
      setPhoto(user.profile_photo ?? null);
    }
  }, [user, reset]);

  const mut = useMutation({
    mutationFn: (d: any) => authApi.updateMe(d),
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: () => toast.error("Update failed"),
  });

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file, 320, 0.75);
      setPhoto(dataUrl);
      mut.mutate({
        firstName: user?.first_name,
        lastName: user?.last_name,
        phone: user?.phone,
        profilePhoto: dataUrl,
      });
    } catch {
      toast.error("Could not process that photo. Please try again.");
    } finally {
      setPhotoBusy(false);
      e.target.value = "";
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return;
    setResetSending(true);
    try {
      await authApi.forgotPassword(user.email);
      toast.success(`Password reset link sent to ${user.email}`);
    } catch {
      toast.error("Could not send reset link. Please try again.");
    } finally {
      setResetSending(false);
    }
  }

  const countryName = COUNTRIES.find((c) => c.code === user?.country)?.name ?? "United States";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <label className="relative cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-navy-600 flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>{user?.first_name?.[0]}{user?.last_name?.[0]}</>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <span className="text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                {photoBusy ? "…" : "Edit"}
              </span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} disabled={photoBusy} />
          </label>
          <div>
            <p className="font-semibold text-gray-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className={`text-xs mt-1 inline-block ${user?.kyc_status === "approved" ? "badge-green" : "badge-amber"}`}>
              KYC {user?.kyc_status}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">First name</label>
              <input {...register("firstName")} className="input" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input {...register("lastName")} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register("phone")} className="input" />
          </div>
          <button
            onClick={handleSubmit((d) => mut.mutate({ ...d, profilePhoto: photo ?? undefined }))}
            disabled={mut.isPending}
            className="btn-primary py-2.5 px-5 mt-2"
          >
            {mut.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Account details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900 font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Country</span>
            <span className="text-gray-900 font-medium">{countryName}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Display currency</span>
            <span className="text-gray-900 font-medium">{user?.currency ?? "USD"}</span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Security</h2>
        <p className="text-xs text-gray-400 mb-3">We'll email a reset link to {user?.email ?? "your address"}.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={sendPasswordReset} disabled={resetSending} className="btn-secondary py-2 px-4 text-sm">
            {resetSending ? "Sending..." : "Change password"}
          </button>
          <Link to="/security" className="text-sm text-navy-600 hover:underline">
            View security settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
