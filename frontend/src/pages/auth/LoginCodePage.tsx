import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore, normalizeUser } from "../../stores/auth.store";
import toast from "react-hot-toast";

export default function LoginCodePage() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { setUser, setAccessToken } = useAuthStore();
  const challengeToken = location.state?.challengeToken as string | undefined;
  const emailHint = location.state?.email as string | undefined;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!challengeToken) { navigate("/login", { replace: true }); return; }
    inputRef.current?.focus();
  }, [challengeToken, navigate]);

  async function submit() {
    if (code.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyLoginCode({ challengeToken, code });
      setAccessToken(res.data.accessToken);
      const me = await authApi.getMe();
      setUser(normalizeUser(me.data));
      navigate(me.data.role === "customer" ? "/dashboard" : "/admin/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Oakstones 1 Bank" className="w-12 h-12 object-contain" />
            <span className="text-white text-2xl font-semibold">Oakstones 1 Bank</span>
          </Link>
          <p className="text-white/60 text-sm">Two-step verification</p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Enter your code</h2>
          <p className="text-sm text-gray-500 mb-5">
            We sent a 6-digit code to {emailHint ? <strong>{emailHint}</strong> : "your email"}. It expires in 10 minutes.
          </p>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="numeric"
            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢"
            className="input text-center text-2xl tracking-[0.5em] font-mono"
            maxLength={6}
          />
          <button onClick={submit} disabled={loading} className="btn-primary w-full py-3 mt-4">
            {loading ? "Verifying..." : "Verify & sign in"}
          </button>
          <p className="text-center text-sm text-gray-500 mt-6">
            Didn't get it? <Link to="/login" className="text-navy-600 font-medium hover:underline">Try signing in again</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
