// Oakstones 1 Bank — Registration (lightweight). Collects login identity only.
// KYC details (and selfie) are collected separately after sign-in, on the KYC page.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import toast from "react-hot-toast";

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^[\d\s()+-]{10,}$/, "Enter a valid phone number").optional().or(z.literal("")),
  password: z.string().min(8, "Min 8 chars").regex(/[A-Z]/, "Need an uppercase letter").regex(/[0-9]/, "Need a number"),
  confirm: z.string(),
  agree: z.boolean().refine((v) => v === true, "You must agree to continue"),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      await authApi.register({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      } as any);
      toast.success("Account created! Check your email to verify, then sign in.");
      navigate("/login");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const err = (k: keyof Form) => errors[k] && <p className="ob-err">{String(errors[k]?.message)}</p>;

  return (
    <div className="ob-apply-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=EB+Garamond&display=swap');
        .ob-apply-root{min-height:100vh;background:linear-gradient(135deg,#16513A,#1F6B4A);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;font-family:'EB Garamond',Georgia,serif;}
        .ob-apply-root *{box-sizing:border-box;}
        .ob-apply-wrap{width:100%;max-width:520px;}
        .ob-apply-head{text-align:center;margin-bottom:24px;}
        .ob-apply-head a{display:inline-flex;align-items:center;gap:12px;text-decoration:none;}
        .ob-apply-head img{width:46px;height:46px;object-fit:contain;}
        .ob-apply-head .nm{color:#fff;font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;}
        .ob-apply-card{background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;}
        .ob-apply-body{padding:30px 28px 28px;}
        .ob-apply-body h2{font-family:'Cormorant Garamond',serif;color:#1F6B4A;font-size:28px;margin:0 0 4px;}
        .ob-apply-body .sub{color:#6b6a60;font-size:15px;margin:0 0 22px;}
        .ob-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .ob-row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;}
        .ob-field{margin-bottom:16px;}
        .ob-field.full{grid-column:1/-1;}
        label.ob-l{display:block;font-size:13px;color:#4a4940;margin-bottom:6px;letter-spacing:.02em;}
        .ob-i,.ob-s{width:100%;padding:12px 14px;border:1px solid #d9d4c4;border-radius:8px;font-size:15px;font-family:inherit;background:#fff;color:#33322C;}
        .ob-i:focus,.ob-s:focus{outline:none;border-color:#2E8B5E;box-shadow:0 0 0 3px rgba(46,139,94,.12);}
        .ob-err{color:#b23b3b;font-size:12px;margin:5px 0 0;}
        .ob-hint{color:#9a988c;font-size:12px;margin:5px 0 0;}
        .ob-check{display:flex;gap:10px;align-items:flex-start;margin-top:4px;}
        .ob-check input{margin-top:4px;}
        .ob-check label{font-size:14px;color:#4a4940;}
        .ob-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;}
        .ob-btn{font-size:15px;letter-spacing:.06em;padding:13px 26px;border-radius:8px;border:0;cursor:pointer;font-family:inherit;transition:filter .2s;}
        .ob-btn-primary{background:linear-gradient(135deg,#2E8B5E,#1F6B4A);color:#fff;}
        .ob-btn-primary:hover{filter:brightness(1.05);}
        .ob-btn-ghost{background:#fff;color:#1F6B4A;border:1px solid #d9d4c4;text-decoration:none;display:inline-block;}
        .ob-btn:disabled{opacity:.6;cursor:not-allowed;}
        .ob-secure{background:#FFF8E6;border-bottom:1px solid #F0E2B8;color:#8a6d1c;font-size:13px;padding:10px 28px;text-align:center;}
        .ob-foot{text-align:center;color:rgba(255,255,255,.8);font-size:14px;margin-top:18px;}
        .ob-foot a{color:#F5D08A;text-decoration:none;}
        @media(max-width:560px){.ob-row,.ob-row3{grid-template-columns:1fr;}}
      `}</style>

      <div className="ob-apply-wrap">
        <div className="ob-apply-head">
          <Link to="/">
            <img src="/logo.png" alt="Oakstones 1 Bank" />
            <span className="nm">Oakstones 1 Bank</span>
          </Link>
        </div>

        <div className="ob-apply-card">
          <div className="ob-secure">🔒 Create your account. You'll verify your identity after signing in.</div>
          <form onSubmit={handleSubmit(onSubmit)} className="ob-apply-body" noValidate>
            <h2>Create your account</h2>
            <p className="sub">Just the basics to get started — we'll collect your identity details in the next step.</p>

            <div className="ob-row3">
              <div className="ob-field"><label className="ob-l">First name</label><input className="ob-i" {...register("firstName")} placeholder="Jane" />{err("firstName")}</div>
              <div className="ob-field"><label className="ob-l">Middle</label><input className="ob-i" {...register("middleName")} placeholder="A." /></div>
              <div className="ob-field"><label className="ob-l">Last name</label><input className="ob-i" {...register("lastName")} placeholder="Smith" />{err("lastName")}</div>
            </div>
            <div className="ob-row">
              <div className="ob-field"><label className="ob-l">Email address</label><input className="ob-i" type="email" {...register("email")} placeholder="you@example.com" />{err("email")}</div>
              <div className="ob-field"><label className="ob-l">Mobile phone (optional)</label><input className="ob-i" type="tel" {...register("phone")} placeholder="(555) 000-0000" />{err("phone")}</div>
            </div>
            <div className="ob-row">
              <div className="ob-field"><label className="ob-l">Create password</label><input className="ob-i" type="password" {...register("password")} placeholder="Min 8 chars, 1 uppercase, 1 number" />{err("password")}</div>
              <div className="ob-field"><label className="ob-l">Confirm password</label><input className="ob-i" type="password" {...register("confirm")} placeholder="••••••••" />{err("confirm")}</div>
            </div>
            <div className="ob-field full ob-check">
              <input type="checkbox" id="agree" {...register("agree")} />
              <label htmlFor="agree">I agree to the <Link to="/terms" style={{ color: "#6B2330" }}>Terms of Service</Link> and <Link to="/privacy" style={{ color: "#6B2330" }}>Privacy Policy</Link>.</label>
            </div>
            {err("agree")}

            <div className="ob-actions">
              <Link to="/login" className="ob-btn ob-btn-ghost">Sign in instead</Link>
              <button type="submit" className="ob-btn ob-btn-primary" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
            </div>
          </form>
        </div>

        <p className="ob-foot">Already have an account? <Link to="/login">Sign in</Link> · <Link to="/">Back to home</Link></p>
      </div>
    </div>
  );
}
