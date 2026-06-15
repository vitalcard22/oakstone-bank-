// Oakstone 1 Bank — Account Opening Application (4-stage, KYC-aware)
// Collects US bank application fields with validation. Data minimization:
// only the last 4 digits of the SSN/ID are ever stored.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import toast from "react-hot-toast";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

const schema = z.object({
  // Stage 1 — Identity
  firstName: z.string().min(1, "Required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Required"),
  dob: z.string().refine((d) => {
    if (!d) return false;
    const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 120;
  }, "You must be at least 18 years old"),
  ssn: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Enter a valid 9-digit SSN (e.g. 123-45-6789)"),
  citizenship: z.string().min(1, "Required"),
  // Stage 2 — Contact & address
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^[\d\s()+-]{10,}$/, "Enter a valid phone number"),
  street: z.string().min(1, "Required"),
  unit: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP (e.g. 90210)"),
  // Stage 3 — Identity verification
  idType: z.string().min(1, "Required"),
  idNumber: z.string().min(3, "Required"),
  idState: z.string().optional(),
  // Stage 4 — Account & compliance
  accountType: z.string().min(1, "Required"),
  employment: z.string().min(1, "Required"),
  sourceOfFunds: z.string().min(1, "Required"),
  password: z.string().min(8, "Min 8 chars").regex(/[A-Z]/, "Need an uppercase letter").regex(/[0-9]/, "Need a number"),
  confirm: z.string(),
  agree: z.boolean().refine((v) => v === true, "You must agree to continue"),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type Form = z.infer<typeof schema>;

const STAGES = [
  { n: 1, label: "Identity" },
  { n: 2, label: "Contact & Address" },
  { n: 3, label: "Verification" },
  { n: 4, label: "Account & Review" },
];

// Which fields belong to which stage (for per-stage validation before advancing)
const STAGE_FIELDS: Record<number, (keyof Form)[]> = {
  1: ["firstName", "lastName", "dob", "ssn", "citizenship"],
  2: ["email", "phone", "street", "city", "state", "zip"],
  3: ["idType", "idNumber"],
  4: ["accountType", "employment", "sourceOfFunds", "password", "confirm", "agree"],
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, trigger, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function next() {
    const ok = await trigger(STAGE_FIELDS[stage]);
    if (ok) setStage((s) => Math.min(4, s + 1));
  }
  function back() { setStage((s) => Math.max(1, s - 1)); }

  async function onSubmit(data: Form) {
    setLoading(true);
    try {
      // Full application — backend stores KYC fields (only last-4 of SSN/ID kept).
      await authApi.register({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        dob: data.dob,
        ssn: data.ssn,
        citizenship: data.citizenship,
        street: data.street,
        unit: data.unit,
        city: data.city,
        state: data.state,
        zip: data.zip,
        idType: data.idType,
        idNumber: data.idNumber,
        idState: data.idState,
        accountType: data.accountType,
        employment: data.employment,
        sourceOfFunds: data.sourceOfFunds,
      } as any);
      toast.success("Application submitted! Please sign in.");
      navigate("/login");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Submission failed");
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
        .ob-apply-wrap{width:100%;max-width:680px;}
        .ob-apply-head{text-align:center;margin-bottom:24px;}
        .ob-apply-head a{display:inline-flex;align-items:center;gap:12px;text-decoration:none;}
        .ob-apply-head img{width:46px;height:46px;object-fit:contain;}
        .ob-apply-head .nm{color:#fff;font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;}
        .ob-apply-card{background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;}
        .ob-secure{background:#FFF8E6;border-bottom:1px solid #F0E2B8;color:#8a6d1c;font-size:13px;padding:10px 28px;text-align:center;}
        .ob-steps{display:flex;border-bottom:1px solid #E9E3D4;}
        .ob-stepitem{flex:1;text-align:center;padding:16px 6px;font-size:13px;letter-spacing:.04em;color:#9a988c;position:relative;}
        .ob-stepitem.active{color:#1F6B4A;font-weight:600;}
        .ob-stepitem.done{color:#2E8B5E;}
        .ob-stepitem .dot{display:block;width:26px;height:26px;line-height:26px;border-radius:50%;margin:0 auto 6px;background:#E9E3D4;color:#fff;font-size:13px;}
        .ob-stepitem.active .dot{background:#1F6B4A;}
        .ob-stepitem.done .dot{background:#2E8B5E;}
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
        .ob-btn-ghost{background:#fff;color:#1F6B4A;border:1px solid #d9d4c4;}
        .ob-btn:disabled{opacity:.6;cursor:not-allowed;}
        .ob-review{background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:18px 20px;margin-bottom:18px;}
        .ob-review h3{font-family:'Cormorant Garamond',serif;color:#1F6B4A;font-size:18px;margin:0 0 10px;}
        .ob-review .line{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px dashed #e4ddc9;}
        .ob-review .line span:first-child{color:#9a988c;}
        .ob-foot{text-align:center;color:rgba(255,255,255,.8);font-size:14px;margin-top:18px;}
        .ob-foot a{color:#F5D08A;text-decoration:none;}
        @media(max-width:560px){.ob-row,.ob-row3{grid-template-columns:1fr;}.ob-stepitem .label{display:none;}}
      `}</style>

      <div className="ob-apply-wrap">
        <div className="ob-apply-head">
          <Link to="/">
            <img src="/logo.png" alt="Oakstone 1 Bank" />
            <span className="nm">Oakstone 1 Bank</span>
          </Link>
        </div>

        <div className="ob-apply-card">
          <div className="ob-secure">🔒 Your information is encrypted and protected. We verify your identity in accordance with federal law.</div>

          <div className="ob-steps">
            {STAGES.map((s) => (
              <div key={s.n} className={"ob-stepitem" + (stage === s.n ? " active" : stage > s.n ? " done" : "")}>
                <span className="dot">{stage > s.n ? "✓" : s.n}</span>
                <span className="label">{s.label}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="ob-apply-body" noValidate>
            {stage === 1 && (
              <>
                <h2>Tell us about yourself</h2>
                <p className="sub">Enter your legal name exactly as it appears on your government ID.</p>
                <div className="ob-row3">
                  <div className="ob-field"><label className="ob-l">Legal first name</label><input className="ob-i" {...register("firstName")} placeholder="Jane" />{err("firstName")}</div>
                  <div className="ob-field"><label className="ob-l">Middle</label><input className="ob-i" {...register("middleName")} placeholder="A." /></div>
                  <div className="ob-field"><label className="ob-l">Last name</label><input className="ob-i" {...register("lastName")} placeholder="Smith" />{err("lastName")}</div>
                </div>
                <div className="ob-row">
                  <div className="ob-field"><label className="ob-l">Date of birth</label><input className="ob-i" type="date" {...register("dob")} />{err("dob")}</div>
                  <div className="ob-field"><label className="ob-l">Citizenship status</label>
                    <select className="ob-s" {...register("citizenship")} defaultValue="">
                      <option value="" disabled>Select…</option>
                      <option>U.S. Citizen</option>
                      <option>U.S. Permanent Resident</option>
                      <option>Non-Resident</option>
                    </select>{err("citizenship")}
                  </div>
                </div>
                <div className="ob-field">
                  <label className="ob-l">Social Security Number (SSN / ITIN)</label>
                  <input className="ob-i" {...register("ssn")} placeholder="123-45-6789" inputMode="numeric" autoComplete="off" />
                  <p className="ob-hint">Required by federal law (USA PATRIOT Act) to verify your identity. Your SSN is encrypted and never stored in full.</p>
                  {err("ssn")}
                </div>
              </>
            )}

            {stage === 2 && (
              <>
                <h2>Contact & residential address</h2>
                <p className="sub">We use this to verify your identity. A physical U.S. address is required — PO boxes are not accepted.</p>
                <div className="ob-row">
                  <div className="ob-field"><label className="ob-l">Email address</label><input className="ob-i" type="email" {...register("email")} placeholder="you@example.com" />{err("email")}</div>
                  <div className="ob-field"><label className="ob-l">Mobile phone</label><input className="ob-i" type="tel" {...register("phone")} placeholder="(555) 000-0000" />{err("phone")}</div>
                </div>
                <div className="ob-field full"><label className="ob-l">Street address</label><input className="ob-i" {...register("street")} placeholder="1 Oakstone Plaza" />{err("street")}</div>
                <div className="ob-field full"><label className="ob-l">Apartment / unit (optional)</label><input className="ob-i" {...register("unit")} placeholder="Apt 4B" /></div>
                <div className="ob-row3">
                  <div className="ob-field"><label className="ob-l">City</label><input className="ob-i" {...register("city")} placeholder="New York" />{err("city")}</div>
                  <div className="ob-field"><label className="ob-l">State</label>
                    <select className="ob-s" {...register("state")} defaultValue="">
                      <option value="" disabled>—</option>
                      {US_STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>{err("state")}
                  </div>
                  <div className="ob-field"><label className="ob-l">ZIP code</label><input className="ob-i" {...register("zip")} placeholder="10001" inputMode="numeric" />{err("zip")}</div>
                </div>
              </>
            )}

            {stage === 3 && (
              <>
                <h2>Verify your identity</h2>
                <p className="sub">Provide a government-issued photo ID. In a live application you would also upload a photo of your ID and a selfie.</p>
                <div className="ob-field">
                  <label className="ob-l">ID type</label>
                  <select className="ob-s" {...register("idType")} defaultValue="">
                    <option value="" disabled>Select…</option>
                    <option>U.S. Driver's License</option>
                    <option>State ID Card</option>
                    <option>U.S. Passport</option>
                    <option>Permanent Resident Card</option>
                  </select>{err("idType")}
                </div>
                <div className="ob-row">
                  <div className="ob-field"><label className="ob-l">ID number</label><input className="ob-i" {...register("idNumber")} placeholder="D1234567" autoComplete="off" />{err("idNumber")}</div>
                  <div className="ob-field"><label className="ob-l">Issuing state (if applicable)</label>
                    <select className="ob-s" {...register("idState")} defaultValue="">
                      <option value="">—</option>
                      {US_STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ob-review">
                  <h3>Document upload</h3>
                  <p style={{ margin: 0, fontSize: 14, color: "#6b6a60" }}>You'll be asked to upload the front and back of your ID and take a quick selfie so we can confirm your identity securely.</p>
                </div>
              </>
            )}

            {stage === 4 && (
              <>
                <h2>Account selection & review</h2>
                <p className="sub">Choose your account and confirm a few compliance details.</p>
                <div className="ob-row">
                  <div className="ob-field"><label className="ob-l">Account type</label>
                    <select className="ob-s" {...register("accountType")} defaultValue="">
                      <option value="" disabled>Select…</option>
                      <option>Reserve Checking</option>
                      <option>High-Yield Savings</option>
                      <option>Checking & Savings</option>
                    </select>{err("accountType")}
                  </div>
                  <div className="ob-field"><label className="ob-l">Employment status</label>
                    <select className="ob-s" {...register("employment")} defaultValue="">
                      <option value="" disabled>Select…</option>
                      <option>Employed</option>
                      <option>Self-employed</option>
                      <option>Retired</option>
                      <option>Student</option>
                      <option>Unemployed</option>
                    </select>{err("employment")}
                  </div>
                </div>
                <div className="ob-field full"><label className="ob-l">Primary source of funds</label>
                  <select className="ob-s" {...register("sourceOfFunds")} defaultValue="">
                    <option value="" disabled>Select…</option>
                    <option>Salary / wages</option>
                    <option>Business income</option>
                    <option>Investments</option>
                    <option>Savings</option>
                    <option>Other</option>
                  </select>
                  <p className="ob-hint">Collected to meet Anti-Money-Laundering (AML) requirements.</p>
                  {err("sourceOfFunds")}
                </div>
                <div className="ob-row">
                  <div className="ob-field"><label className="ob-l">Create password</label><input className="ob-i" type="password" {...register("password")} placeholder="Min 8 chars, 1 uppercase, 1 number" />{err("password")}</div>
                  <div className="ob-field"><label className="ob-l">Confirm password</label><input className="ob-i" type="password" {...register("confirm")} placeholder="••••••••" />{err("confirm")}</div>
                </div>
                <div className="ob-field full ob-check">
                  <input type="checkbox" id="agree" {...register("agree")} />
                  <label htmlFor="agree">I confirm the information provided is accurate and agree to the <Link to="/terms" style={{ color: "#6B2330" }}>Terms of Service</Link>, <Link to="/privacy" style={{ color: "#6B2330" }}>Privacy Policy</Link>, and electronic disclosures.</label>
                </div>
                {err("agree")}
              </>
            )}

            <div className="ob-actions">
              {stage > 1
                ? <button type="button" className="ob-btn ob-btn-ghost" onClick={back}>Back</button>
                : <Link to="/login" className="ob-btn ob-btn-ghost" style={{ textDecoration: "none", display: "inline-block" }}>Sign in instead</Link>}
              {stage < 4
                ? <button type="button" className="ob-btn ob-btn-primary" onClick={next}>Continue</button>
                : <button type="submit" className="ob-btn ob-btn-primary" disabled={loading}>{loading ? "Submitting…" : "Submit application"}</button>}
            </div>
          </form>
        </div>

        <p className="ob-foot">Already have an account? <Link to="/login">Sign in</Link> · <Link to="/">Back to home</Link></p>
      </div>
    </div>
  );
}
