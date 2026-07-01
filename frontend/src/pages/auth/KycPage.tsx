// Oakstones 1 Bank — Identity Verification (KYC). Completed after sign-in.
// Collects KYC fields + a selfie (captured on device, resized client-side, sent as
// a compact JPEG data URL). Admin reviews the selfie manually before approval.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import toast from "react-hot-toast";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

const schema = z.object({
  dob: z.string().refine((d) => {
    if (!d) return false;
    const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 120;
  }, "You must be at least 18 years old"),
  ssn: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Enter a valid 9-digit SSN (e.g. 123-45-6789)"),
  citizenship: z.string().min(1, "Required"),
  street: z.string().min(1, "Required"),
  unit: z.string().optional(),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP (e.g. 90210)"),
  idType: z.string().min(1, "Required"),
  idNumber: z.string().min(3, "Required"),
  idState: z.string().optional(),
  accountType: z.string().min(1, "Required"),
  employment: z.string().min(1, "Required"),
  sourceOfFunds: z.string().min(1, "Required"),
});

type Form = z.infer<typeof schema>;

const STAGES = [
  { n: 1, label: "Personal" },
  { n: 2, label: "ID Document" },
  { n: 3, label: "Selfie" },
  { n: 4, label: "Review" },
];

const STAGE_FIELDS: Record<number, (keyof Form)[]> = {
  1: ["dob", "ssn", "citizenship", "street", "city", "state", "zip"],
  2: ["idType", "idNumber"],
  3: [],
  4: ["accountType", "employment", "sourceOfFunds"],
};

// Resize an image File to a compact JPEG data URL (keeps the upload small for the DB).
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

export default function KycPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [selfieBusy, setSelfieBusy] = useState(false);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [idBusy, setIdBusy] = useState<"" | "front" | "back">("");
  const { register, handleSubmit, trigger, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSelfie(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file, 480, 0.7);
      setSelfie(dataUrl);
    } catch {
      toast.error("Could not process that photo. Please try again.");
    } finally {
      setSelfieBusy(false);
      e.target.value = "";
    }
  }

  async function onIdImage(e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdBusy(side);
    try {
      // Larger + lighter compression than the selfie so the ID text stays readable.
      const dataUrl = await fileToDataUrl(file, 1000, 0.65);
      (side === "front" ? setIdFront : setIdBack)(dataUrl);
    } catch {
      toast.error("Could not process that image. Please try again.");
    } finally {
      setIdBusy("");
      e.target.value = "";
    }
  }

  async function next() {
    const ok = await trigger(STAGE_FIELDS[stage]);
    if (!ok) return;
    if (stage === 2 && !idFront) { toast.error("Please add the front of your ID to continue."); return; }
    if (stage === 3 && !selfie) { toast.error("Please take a selfie to continue."); return; }
    setStage((s) => Math.min(4, s + 1));
  }
  function back() { setStage((s) => Math.max(1, s - 1)); }

  async function onSubmit(data: Form) {
    if (!idFront) { toast.error("The front of your ID is required."); setStage(2); return; }
    if (!selfie) { toast.error("A selfie is required."); setStage(3); return; }
    setLoading(true);
    try {
      await authApi.submitKyc({ ...data, selfie, idFront, idBack } as any);
      toast.success("Identity verification submitted! We'll review it shortly.");
      navigate("/dashboard");
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
        .ob-actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px;}
        .ob-btn{font-size:15px;letter-spacing:.06em;padding:13px 26px;border-radius:8px;border:0;cursor:pointer;font-family:inherit;transition:filter .2s;}
        .ob-btn-primary{background:linear-gradient(135deg,#2E8B5E,#1F6B4A);color:#fff;}
        .ob-btn-primary:hover{filter:brightness(1.05);}
        .ob-btn-ghost{background:#fff;color:#1F6B4A;border:1px solid #d9d4c4;text-decoration:none;display:inline-block;}
        .ob-btn:disabled{opacity:.6;cursor:not-allowed;}
        .ob-review{background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:18px 20px;margin-bottom:18px;}
        .ob-review h3{font-family:'Cormorant Garamond',serif;color:#1F6B4A;font-size:18px;margin:0 0 10px;}
        .ob-foot{text-align:center;color:rgba(255,255,255,.8);font-size:14px;margin-top:18px;}
        .ob-foot a{color:#F5D08A;text-decoration:none;}
        .ob-selfie-box{text-align:center;padding:10px 0;}
        .ob-selfie-frame{width:200px;height:200px;border-radius:50%;margin:0 auto 18px;background:#F2F0E8;border:3px solid #E9E3D4;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        .ob-selfie-frame img{width:100%;height:100%;object-fit:cover;}
        .ob-selfie-frame .ph{color:#b8b4a4;font-size:48px;}
        .ob-cam-btn{display:inline-block;background:linear-gradient(135deg,#2E8B5E,#1F6B4A);color:#fff;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:15px;letter-spacing:.04em;}
        .ob-cam-input{display:none;}
        .ob-idgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:6px;}
        .ob-idframe{width:100%;aspect-ratio:1.586/1;border-radius:10px;background:#F2F0E8;border:2px dashed #d9d4c4;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:10px;}
        .ob-idframe img{width:100%;height:100%;object-fit:cover;}
        .ob-idframe .ph{font-size:40px;opacity:.5;}
        .ob-idbtn{display:block;text-align:center;background:#fff;color:#1F6B4A;border:1px solid #2E8B5E;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:14px;}
        @media(max-width:560px){.ob-row,.ob-row3{grid-template-columns:1fr;}.ob-stepitem .label{display:none;}.ob-idgrid{grid-template-columns:1fr;}}
      `}</style>

      <div className="ob-apply-wrap">
        <div className="ob-apply-head">
          <Link to="/dashboard">
            <img src="/logo.png" alt="Oakstones 1 Bank" />
            <span className="nm">Oakstones 1 Bank</span>
          </Link>
        </div>

        <div className="ob-apply-card">
          <div className="ob-secure">🔒 Your information is encrypted. We verify your identity in accordance with federal law.</div>

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
                <h2>Personal & address</h2>
                <p className="sub">Enter details exactly as they appear on your government ID.</p>
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
                  <p className="ob-hint">Required by federal law (USA PATRIOT Act). Only the last 4 digits are stored.</p>
                  {err("ssn")}
                </div>
                <div className="ob-field full"><label className="ob-l">Street address</label><input className="ob-i" {...register("street")} placeholder="1 Oakstones Plaza" />{err("street")}</div>
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

            {stage === 2 && (
              <>
                <h2>Identity document</h2>
                <p className="sub">Provide a government-issued photo ID.</p>
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

                <p className="ob-l" style={{ marginTop: 8, marginBottom: 10 }}>Upload or take a photo of your ID. On a phone this opens your camera; on a computer you can upload a file.</p>
                <div className="ob-idgrid">
                  <div className="ob-idbox">
                    <div className="ob-idframe">
                      {idFront ? <img src={idFront} alt="Front of ID" /> : <span className="ph">🪪</span>}
                    </div>
                    <label className="ob-idbtn">
                      {idBusy === "front" ? "Processing…" : idFront ? "Replace front" : "Front of ID *"}
                      <input className="ob-cam-input" type="file" accept="image/*" capture="environment" onChange={(e) => onIdImage(e, "front")} disabled={idBusy !== ""} />
                    </label>
                  </div>
                  <div className="ob-idbox">
                    <div className="ob-idframe">
                      {idBack ? <img src={idBack} alt="Back of ID" /> : <span className="ph">🪪</span>}
                    </div>
                    <label className="ob-idbtn">
                      {idBusy === "back" ? "Processing…" : idBack ? "Replace back" : "Back of ID (optional)"}
                      <input className="ob-cam-input" type="file" accept="image/*" capture="environment" onChange={(e) => onIdImage(e, "back")} disabled={idBusy !== ""} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {stage === 3 && (
              <>
                <h2>Take a selfie</h2>
                <p className="sub">We compare your selfie to your ID to confirm it's really you. Make sure your face is well-lit and centered.</p>
                <div className="ob-selfie-box">
                  <div className="ob-selfie-frame">
                    {selfie ? <img src={selfie} alt="Your selfie" /> : <span className="ph">📷</span>}
                  </div>
                  <label className="ob-cam-btn">
                    {selfieBusy ? "Processing…" : selfie ? "Retake selfie" : "Take selfie"}
                    <input className="ob-cam-input" type="file" accept="image/*" capture="user" onChange={onSelfie} disabled={selfieBusy} />
                  </label>
                  <p className="ob-hint" style={{ marginTop: 14 }}>On a phone this opens your front camera. On a computer you can upload a clear photo of your face.</p>
                </div>
              </>
            )}

            {stage === 4 && (
              <>
                <h2>Account & compliance</h2>
                <p className="sub">A few last details, then submit for review.</p>
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
                <div className="ob-review">
                  <h3>Ready to submit</h3>
                  <p style={{ margin: 0, fontSize: 14, color: "#6b6a60" }}>Your details and selfie will be reviewed by our team. You'll get an email once your account is open. No further action is needed after you submit.</p>
                </div>
              </>
            )}

            <div className="ob-actions">
              {stage > 1
                ? <button type="button" className="ob-btn ob-btn-ghost" onClick={back}>Back</button>
                : <Link to="/dashboard" className="ob-btn ob-btn-ghost">Do this later</Link>}
              {stage < 4
                ? <button type="button" className="ob-btn ob-btn-primary" onClick={next}>Continue</button>
                : <button type="submit" className="ob-btn ob-btn-primary" disabled={loading}>{loading ? "Submitting…" : "Submit for review"}</button>}
            </div>
          </form>
        </div>

        <p className="ob-foot"><Link to="/dashboard">Back to dashboard</Link></p>
      </div>
    </div>
  );
}
