import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL ?? "https://backend-rough-snowfall-7400.fly.dev";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); setMessage("This verification link is missing its token."); return; }
    axios.get(`${API}/api/v1/auth/verify-email`, { params: { token } })
      .then(() => { setStatus("ok"); setMessage("Your email address has been verified."); })
      .catch((e) => { setStatus("error"); setMessage(e.response?.data?.error ?? "This verification link is invalid or has expired."); });
  }, [params]);

  return (
    <div className="ob-verify-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=EB+Garamond&display=swap');
        .ob-verify-root{min-height:100vh;background:linear-gradient(135deg,#16513A,#1F6B4A);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'EB Garamond',Georgia,serif;}
        .ob-verify-card{background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);max-width:460px;width:100%;text-align:center;overflow:hidden;}
        .ob-verify-head{background:linear-gradient(135deg,#1F6B4A,#16513A);padding:28px;}
        .ob-verify-head img{width:52px;height:52px;object-fit:contain;}
        .ob-verify-head .nm{color:#fff;font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;margin-top:8px;}
        .ob-verify-body{padding:36px 32px;}
        .ob-icon{font-size:46px;margin-bottom:14px;}
        .ob-verify-body h1{font-family:'Cormorant Garamond',serif;font-size:26px;margin:0 0 10px;color:#1F6B4A;}
        .ob-verify-body p{color:#6b6a60;font-size:16px;margin:0 0 24px;line-height:1.5;}
        .ob-verify-btn{display:inline-block;text-decoration:none;background:linear-gradient(135deg,#2E8B5E,#1F6B4A);color:#fff;padding:13px 32px;border-radius:8px;font-size:15px;letter-spacing:.05em;}
      `}</style>
      <div className="ob-verify-card">
        <div className="ob-verify-head">
          <img src="/logo.png" alt="Oakstone 1 Bank" />
          <div className="nm">Oakstone 1 Bank</div>
        </div>
        <div className="ob-verify-body">
          {status === "loading" && (<><div className="ob-icon">⏳</div><h1>Verifying…</h1><p>One moment while we confirm your email address.</p></>)}
          {status === "ok" && (<><div className="ob-icon">✅</div><h1>Email verified</h1><p>{message} You may now sign in to your account.</p><Link to="/login" className="ob-verify-btn">Sign In</Link></>)}
          {status === "error" && (<><div className="ob-icon">⚠️</div><h1>Verification failed</h1><p>{message}</p><Link to="/login" className="ob-verify-btn">Go to Sign In</Link></>)}
        </div>
      </div>
    </div>
  );
}
