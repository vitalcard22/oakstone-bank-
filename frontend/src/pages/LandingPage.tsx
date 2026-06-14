// Oakstone 1 Bank — Complete heritage landing page
// White background, bright emerald accents. Uses /logo.png and /hero.jpg from public/.
// Includes: trust bar, mobile menu, hero, heritage, services, reserve card,
// rates, segments, security, FAQ, testimonials, presence, contact, footer, cookie banner.
//
// Wire to "/" in your router. Legal pages (privacy/terms/cookies/disclosures) are separate files.

import React, { useState } from "react";

const LOGO_SRC = "/logo.png";
const HERO_SRC = "/hero.jpg";
const HERITAGE_SRC = "/heritage.jpg";

const services = [
  { name: "Accounts", body: "Checking and savings held with century-old discipline. Open, fund, and manage every account from one ledger." },
  { name: "Transfers", body: "Move funds between your accounts or to another party — settled securely, recorded permanently." },
  { name: "Send Money", body: "Pay a person directly, or send by Zelle. Quick when you need it, with the safeguards of an old institution." },
  { name: "Cards", body: "Apply for a credit card, review your line, and freeze a card in an instant if it ever leaves your sight." },
  { name: "Loans", body: "Apply for lending against a future you can see. Considered terms, reviewed by people, not algorithms alone." },
  { name: "Bill Pay", body: "Settle recurring obligations on schedule, with every payment monitored and accounted for." },
];

const segments = [
  { title: "Individuals", body: "Households seeking a permanent home for their savings and a banker who remembers their name.", img: "/seg-individuals.jpg" },
  { title: "Businesses", body: "Firms that value a lender who understands the long arc of an enterprise rather than the quarter.", img: "/seg-business.jpg" },
  { title: "Private Clients", body: "Families and principals entrusting substantial assets to an institution built to outlast them.", img: "/seg-private.jpg" },
];

const rates = [
  { label: "High-Yield Savings", value: "4.50%", note: "Annual Percentage Yield" },
  { label: "12-Month Certificate", value: "4.85%", note: "Annual Percentage Yield" },
  { label: "Reserve Checking", value: "0.75%", note: "Annual Percentage Yield" },
];

const faqs = [
  { q: "How do I open an account?", a: "Select “Open an Account,” provide a few details for identity verification, and fund your account. Most applications are reviewed within one business day." },
  { q: "Is my money insured?", a: "Yes. Deposits are insured by the Federal Deposit Insurance Corporation (FDIC) up to the maximum permitted by law." },
  { q: "Can I freeze my card if I lose it?", a: "Instantly. From your dashboard you can freeze and unfreeze any card yourself, at any hour, with no call required." },
  { q: "Do you have physical branches?", a: "We do. Our headquarters and regional branches welcome clients during banking hours — no appointment necessary." },
  { q: "How is my account protected?", a: "Every account is secured with bank-grade encryption, continuous fraud monitoring, and round-the-clock account oversight." },
];

const testimonials = [
  { quote: "Three generations of my family have banked with Oakstone. They have never once given us reason to look elsewhere.", name: "Eleanor V.", role: "Private client, since 1987", img: "/avatar-1.jpg" },
  { quote: "When my card was compromised abroad, it was frozen and reissued before I’d finished my coffee. That is service.", name: "Marcus T.", role: "Reserve cardholder", img: "/avatar-2.jpg" },
  { quote: "They lent to my business when the numbers were hard to read. A banker, not an algorithm, made that call.", name: "Raj N.", role: "Business client", img: "/avatar-3.jpg" },
];

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="ob-faq-item">
      <button className="ob-faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{q}</span>
        <span className="ob-faq-mark">{open ? "–" : "+"}</span>
      </button>
      {open && <div className="ob-faq-a">{a}</div>}
    </div>
  );
};

const ReserveCard: React.FC = () => (
  <div className="ob-cc">
    <div className="ob-cc-frame" />
    <div className="ob-cc-top">
      <div className="ob-cc-name">Oakstone 1 Bank</div>
      <div className="ob-cc-tier">RESERVE</div>
    </div>
    <img className="ob-cc-seal" src={LOGO_SRC} alt="Oakstone 1 Bank seal" />
    <div className="ob-cc-chip" />
    <div className="ob-cc-nfc"><span /><span /><span /></div>
    <div className="ob-cc-number">4914&nbsp;&nbsp;0001&nbsp;&nbsp;1914&nbsp;&nbsp;0001</div>
    <div className="ob-cc-meta">
      <span className="ob-cc-lbl">VALID THRU</span>
      <span className="ob-cc-val">12 / 30</span>
    </div>
    <div className="ob-cc-holder">Cardholder Name</div>
    <div className="ob-cc-network">VISA</div>
    <div className="ob-cc-sheen" />
  </div>
)

const LandingPage: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cookieOk, setCookieOk] = useState(true); // hide unless you wire persistence

  return (
    <div className="ob-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

        .ob-root {
          --white:#FFFFFF; --off:#F7FBF8; --line:#E9E3D4;
          --emerald:#1F6B4A; --emerald-light:#2E8B5E; --emerald-deep:#16513A;
          --ink:#33322C; --muted:#5C5A4F;
          --gold:#C08A2D; --gold-light:#E0A93C; --cream-gold:#F5D08A;
          --oxblood:#6B2330;
          --display:'Cormorant Garamond',Georgia,serif; --body:'EB Garamond',Georgia,serif;
          background:var(--white); color:var(--ink); font-family:var(--body);
          font-size:18px; line-height:1.65; -webkit-font-smoothing:antialiased;
        }
        .ob-root *{box-sizing:border-box;}
        .ob-wrap{max-width:1100px;margin:0 auto;padding:0 32px;}
        .ob-eyebrow{text-transform:uppercase;letter-spacing:.3em;font-size:12px;color:var(--gold);margin:0 0 18px;}
        .ob-rule{width:64px;height:3px;border:0;background:linear-gradient(90deg,var(--gold-light),var(--gold));border-radius:2px;margin:0 0 28px;}
        h1,h2,h3{font-family:var(--display);font-weight:600;margin:0;color:var(--emerald);}

        /* Header */
        .ob-topline{border-bottom:1px solid var(--line);}
        .ob-header{display:flex;align-items:center;justify-content:space-between;max-width:1100px;margin:0 auto;padding:16px 32px;}
        .ob-brand{display:flex;align-items:center;gap:13px;}
        .ob-brand img{width:52px;height:52px;object-fit:contain;}
        .ob-brand-name{font-family:var(--display);font-size:24px;font-weight:600;letter-spacing:.03em;color:var(--emerald);line-height:1;}
        .ob-brand-sub{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--gold);margin-top:3px;}
        .ob-nav{display:flex;gap:26px;align-items:center;}
        .ob-nav a{color:#4A4940;text-decoration:none;font-size:15px;transition:color .35s;}
        .ob-nav a:hover{color:var(--oxblood);}
        .ob-nav .ob-open{color:var(--emerald);border:1px solid var(--gold-light);padding:8px 18px;border-radius:6px;}
        .ob-nav .ob-signin{color:#fff;background:linear-gradient(135deg,var(--emerald-light),var(--emerald));padding:9px 20px;border-radius:6px;box-shadow:0 4px 12px rgba(31,107,74,.25);}
        .ob-burger{display:none;background:none;border:0;cursor:pointer;flex-direction:column;gap:5px;padding:6px;}
        .ob-burger span{display:block;width:24px;height:2px;background:var(--emerald);}
        .ob-mobile{display:none;flex-direction:column;gap:4px;padding:8px 32px 18px;border-bottom:1px solid var(--line);}
        .ob-mobile a{padding:11px 0;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--line);font-size:16px;}

        /* Buttons */
        .ob-btn{display:inline-block;font-size:15px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;padding:15px 32px;border-radius:7px;transition:all .4s;cursor:pointer;}
        .ob-btn-primary{background:linear-gradient(135deg,var(--emerald-light),var(--emerald));color:#fff;box-shadow:0 8px 22px rgba(31,107,74,.28);}
        .ob-btn-primary:hover{filter:brightness(1.05);}
        .ob-btn-ghost{background:rgba(224,169,60,.06);color:var(--emerald);border:1px solid var(--gold-light);}
        .ob-btn-ghost:hover{background:rgba(224,169,60,.12);}

        /* Hero */
        .ob-hero{background:radial-gradient(60% 80% at 78% 30%,rgba(224,169,60,.14) 0%,rgba(224,169,60,0) 60%),radial-gradient(70% 90% at 10% 90%,rgba(46,139,94,.08) 0%,rgba(46,139,94,0) 55%),var(--white);}
        .ob-hero-inner{max-width:1100px;margin:0 auto;padding:64px 32px 72px;display:grid;grid-template-columns:1.02fr .98fr;gap:48px;align-items:center;}
        .ob-hero h1{font-size:56px;line-height:1.05;}
        .ob-hero-sub{color:var(--muted);font-size:19px;max-width:30em;margin:22px 0 32px;}
        .ob-hero-cta{display:flex;gap:16px;flex-wrap:wrap;}
        .ob-photo{margin:0;}
        .ob-photo img{width:100%;height:auto;display:block;border-radius:10px;box-shadow:0 22px 60px rgba(31,107,74,.2);border:3px solid #fff;outline:1px solid var(--line);}
        .ob-photo figcaption{font-family:var(--display);font-style:italic;font-size:17px;color:var(--gold);text-align:center;margin-top:18px;}

        /* Sections */
        .ob-section{padding:74px 0;}
        .ob-section h2{font-size:40px;margin-bottom:8px;}
        .ob-lead{font-size:19px;max-width:40em;color:var(--muted);}
        .ob-alt{background:var(--off);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}

        /* Heritage */
        .ob-heritage-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;}
        .ob-heritage p{margin:0 0 16px;color:var(--ink);}
        .ob-heritage-visual{position:relative;}
        .ob-heritage-photo{width:100%;height:auto;display:block;border-radius:10px;box-shadow:0 18px 44px rgba(31,107,74,.2);border:3px solid #fff;outline:1px solid var(--line);}
        .ob-heritage-seal{display:flex;justify-content:center;background:radial-gradient(circle,rgba(224,169,60,.16),rgba(224,169,60,0) 70%);border-radius:50%;position:absolute;right:-18px;bottom:-26px;width:120px;height:120px;background-color:#fff;box-shadow:0 8px 22px rgba(0,0,0,.15);}
        .ob-heritage-seal img{width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(31,107,74,.22));}

        /* Services */
        .ob-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:42px;}
        .ob-card{display:block;text-decoration:none;background:#fff;padding:30px 26px;border-radius:12px;border:1px solid var(--line);border-top:3px solid var(--gold-light);box-shadow:0 6px 20px rgba(31,107,74,.06);transition:transform .4s,box-shadow .4s;cursor:pointer;}
        .ob-card:hover{transform:translateY(-3px);box-shadow:0 16px 38px rgba(31,107,74,.14);}
        .ob-card:hover .ob-card-link{color:var(--emerald);}
        .ob-card h3{font-size:24px;margin-bottom:10px;}
        .ob-card p{margin:0;color:var(--muted);font-size:17px;}
        .ob-card .ob-idx{font-family:var(--display);font-weight:600;font-size:14px;letter-spacing:.2em;color:var(--gold);display:block;margin-bottom:12px;}
        .ob-card-link{display:inline-block;margin-top:16px;font-size:14px;letter-spacing:.06em;color:var(--gold);font-weight:500;transition:color .3s;}

        /* Reserve card section */
        .ob-card-section{background:linear-gradient(135deg,var(--emerald-deep),var(--emerald));color:#fff;}
        .ob-card-section .ob-eyebrow{color:var(--cream-gold);}
        .ob-card-section h2{color:#fff;}
        .ob-card-section .ob-rule{background:var(--cream-gold);}
        .ob-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;margin-top:16px;}
        .ob-card-copy p{color:rgba(255,255,255,.85);font-size:18px;margin:0 0 22px;max-width:32em;}
        .ob-card-feats{list-style:none;padding:0;margin:0 0 28px;}
        .ob-card-feats li{padding:10px 0;border-bottom:1px solid rgba(245,208,138,.3);color:rgba(255,255,255,.9);}
        .ob-card-feats li:before{content:"—";color:var(--cream-gold);margin-right:12px;}
        .ob-cc-cta{display:inline-block;font-size:14px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;padding:14px 30px;border-radius:7px;background:var(--cream-gold);color:var(--emerald);}
        .ob-cc-cta:hover{background:#fff;}
        .ob-cc{position:relative;width:100%;max-width:460px;aspect-ratio:1.586/1;margin:0 auto;border-radius:22px;overflow:hidden;color:#eef2ee;font-family:var(--display);background:linear-gradient(135deg,rgba(255,255,255,.06) 0%,transparent 22%),radial-gradient(140% 120% at 15% 10%,#2b6b4d 0%,#1c5238 30%,#133b29 55%,#0c2a1d 80%,#081d14 100%);box-shadow:0 40px 80px rgba(0,0,0,.55),inset 0 1px 1px rgba(255,255,255,.18),inset 0 -2px 6px rgba(0,0,0,.5);}
        .ob-cc:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(122deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);mix-blend-mode:overlay;pointer-events:none;}
        .ob-cc-sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,transparent 28%,rgba(255,255,255,.22) 44%,rgba(255,255,255,.05) 50%,transparent 58%);}
        .ob-cc-frame{position:absolute;inset:14px;border:1px solid rgba(212,175,108,.45);border-radius:14px;box-shadow:inset 0 0 18px rgba(212,175,108,.08);pointer-events:none;}
        .ob-cc-top{position:absolute;left:7%;top:11%;}
        .ob-cc-name{font-size:25px;font-weight:600;color:#eef2ee;text-shadow:0 1px 2px rgba(0,0,0,.4);}
        .ob-cc-tier{font-size:10px;letter-spacing:.46em;color:#d8b974;margin-top:6px;}
        .ob-cc-seal{position:absolute;right:5.5%;top:9%;width:24%;aspect-ratio:1/1;object-fit:contain;filter:drop-shadow(0 2px 7px rgba(0,0,0,.55));}
        .ob-cc-chip{position:absolute;left:7.5%;top:39%;width:56px;height:43px;border-radius:7px;background:linear-gradient(135deg,#f6e3a6 0%,#d9b463 40%,#b08e3f 70%,#8a6c2c 100%);box-shadow:inset 0 1px 2px rgba(255,255,255,.7),inset 0 -1px 3px rgba(80,60,15,.5),0 1px 2px rgba(0,0,0,.35);}
        .ob-cc-chip:before{content:"";position:absolute;inset:0;border-radius:7px;background:linear-gradient(transparent 31%,rgba(90,70,25,.55) 31% 33%,transparent 33%),linear-gradient(transparent 64%,rgba(90,70,25,.55) 64% 66%,transparent 66%),linear-gradient(90deg,transparent 47%,rgba(90,70,25,.55) 47% 53%,transparent 53%);}
        .ob-cc-nfc{position:absolute;left:calc(7.5% + 74px);top:39%;width:30px;height:43px;}
        .ob-cc-nfc span{position:absolute;top:50%;left:0;border:2.5px solid rgba(238,242,238,.65);border-radius:50%;border-color:transparent rgba(238,242,238,.65) rgba(238,242,238,.65) transparent;transform:translateY(-50%) rotate(-45deg);}
        .ob-cc-nfc span:nth-child(1){width:10px;height:10px;}
        .ob-cc-nfc span:nth-child(2){width:20px;height:20px;left:-5px;}
        .ob-cc-nfc span:nth-child(3){width:30px;height:30px;left:-10px;}
        .ob-cc-number{position:absolute;left:7.5%;top:58%;right:7%;font-family:'Courier New',monospace;font-weight:700;font-size:clamp(16px,4.4vw,24px);letter-spacing:.12em;color:#f3f6f2;text-shadow:0 1px 0 rgba(255,255,255,.25),0 2px 3px rgba(0,0,0,.5);}
        .ob-cc-meta{position:absolute;left:7.5%;top:72%;display:flex;align-items:baseline;gap:10px;}
        .ob-cc-lbl{font-size:8px;letter-spacing:.22em;color:#d8b974;}
        .ob-cc-val{font-family:'Courier New',monospace;font-size:15px;color:#eef2ee;letter-spacing:.05em;}
        .ob-cc-holder{position:absolute;left:7.5%;bottom:8%;font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:#eef2ee;}
        .ob-cc-network{position:absolute;right:7%;bottom:6.5%;font-size:22px;font-weight:600;font-style:italic;color:#eef2ee;text-shadow:0 1px 2px rgba(0,0,0,.4);}

        /* Rates */
        .ob-rates-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:42px;}
        .ob-rate{text-align:center;padding:34px 24px;border:1px solid var(--line);border-radius:12px;background:#fff;}
        .ob-rate .ob-rate-val{font-family:var(--display);font-size:46px;color:var(--emerald);line-height:1;}
        .ob-rate .ob-rate-label{font-size:17px;color:var(--ink);margin-top:10px;}
        .ob-rate .ob-rate-note{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:4px;}

        /* Segments */
        .ob-segments{background:linear-gradient(135deg,var(--emerald-light),var(--emerald));}
        .ob-segments h2,.ob-segments .ob-eyebrow{color:#fff;}
        .ob-segments .ob-eyebrow{color:var(--cream-gold);}
        .ob-segments .ob-lead{color:rgba(255,255,255,.85);}
        .ob-segments .ob-rule{background:var(--cream-gold);}
        .ob-seg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-top:42px;}
        .ob-seg{background:rgba(255,255,255,.06);border:1px solid rgba(245,208,138,.25);border-radius:14px;overflow:hidden;text-align:left;}
        .ob-seg-photo{width:100%;aspect-ratio:3/2;overflow:hidden;}
        .ob-seg-photo img{width:100%;height:100%;object-fit:cover;display:block;}
        .ob-seg h3{color:var(--cream-gold);font-size:25px;margin:20px 24px 10px;}
        .ob-seg p{color:rgba(255,255,255,.88);margin:0 24px 24px;}

        /* Security */
        .ob-security-list{list-style:none;padding:0;margin:36px 0 0;max-width:46em;}
        .ob-security-list li{padding:20px 0;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:baseline;}
        .ob-security-list li:first-child{border-top:1px solid var(--line);}
        .ob-security-list .ob-k{font-family:var(--display);color:var(--oxblood);font-size:20px;min-width:13em;}
        .ob-security-list .ob-v{color:var(--muted);}

        /* Strength */
        .ob-strength{background:linear-gradient(135deg,var(--emerald),var(--emerald-deep));}
        .ob-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;text-align:center;}
        .ob-stat .ob-num{font-family:var(--display);font-size:54px;color:var(--cream-gold);line-height:1;}
        .ob-stat .ob-cap{display:block;margin-top:12px;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.72);}
        .ob-stat+.ob-stat{border-left:1px solid rgba(245,208,138,.3);}

        /* FAQ */
        .ob-faq{max-width:760px;margin:34px auto 0;}
        .ob-faq-item{border-bottom:1px solid var(--line);}
        .ob-faq-q{width:100%;text-align:left;background:none;border:0;cursor:pointer;padding:20px 0;display:flex;justify-content:space-between;align-items:center;font-family:var(--display);font-size:22px;color:var(--emerald);}
        .ob-faq-mark{color:var(--gold);font-size:24px;}
        .ob-faq-a{padding:0 0 20px;color:var(--muted);font-size:17px;}

        /* Testimonials */
        .ob-testi{background:var(--off);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
        .ob-testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:42px;}
        .ob-testi-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:30px 28px;}
        .ob-testi-card .q{font-family:var(--display);font-style:italic;font-size:20px;color:var(--ink);line-height:1.5;}
        .ob-testi-person{display:flex;align-items:center;gap:14px;margin-top:20px;}
        .ob-testi-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--gold-light);flex-shrink:0;}
        .ob-testi-card .n{font-weight:500;color:var(--emerald);}
        .ob-testi-card .r{font-size:14px;color:var(--muted);}
        .ob-security-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:center;}
        .ob-security-photo img{width:100%;height:auto;border-radius:12px;box-shadow:0 16px 40px rgba(31,107,74,.18);display:block;}
        .ob-cta{position:relative;background:linear-gradient(135deg,rgba(22,81,58,.92),rgba(31,107,74,.85)),url('/cta-bg.jpg');background-size:cover;background-position:center;text-align:center;}
        .ob-cta h2{color:#fff;font-size:44px;margin-bottom:14px;text-shadow:0 2px 8px rgba(0,0,0,.3);}
        .ob-cta p{color:rgba(255,255,255,.9);font-size:19px;max-width:34em;margin:0 auto 30px;text-shadow:0 1px 4px rgba(0,0,0,.3);}
        .ob-cta .ob-btn{font-size:16px;}
        .ob-cta-btn{display:inline-block;font-size:16px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:7px;background:var(--cream-gold);color:var(--emerald-deep);font-weight:500;transition:background .3s;box-shadow:0 8px 22px rgba(0,0,0,.25);}
        .ob-cta-btn:hover{background:#fff;}

        /* Presence */
        .ob-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:42px;}
        .ob-step{text-align:center;padding:0 12px;}
        .ob-step-num{width:54px;height:54px;margin:0 auto 18px;border-radius:50%;background:linear-gradient(135deg,var(--emerald-light),var(--emerald));color:#fff;font-family:var(--display);font-size:26px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(31,107,74,.25);}
        .ob-step h3{font-size:24px;margin-bottom:10px;}
        .ob-step p{margin:0;color:var(--muted);font-size:17px;}

        /* Contact */
        .ob-contact-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:40px;margin-top:40px;max-width:720px;margin-left:auto;margin-right:auto;}
        .ob-contact h3{font-size:22px;margin-bottom:8px;}
        .ob-contact a{color:var(--oxblood);text-decoration:none;}
        .ob-contact a:hover{text-decoration:underline;}

        /* Footer */
        .ob-footer{background:linear-gradient(135deg,var(--emerald),var(--emerald-deep));color:rgba(255,255,255,.8);padding:54px 0 34px;}
        .ob-footer img{width:54px;height:54px;object-fit:contain;}
        .ob-footer-top{display:flex;justify-content:space-between;align-items:flex-start;gap:40px;flex-wrap:wrap;}
        .ob-footer-links{display:flex;gap:28px;flex-wrap:wrap;}
        .ob-footer-links a{color:rgba(255,255,255,.8);text-decoration:none;font-size:15px;}
        .ob-footer-links a:hover{color:var(--cream-gold);}
        .ob-footer .ob-brand-name{color:#fff;}
        .ob-footer-legal{margin-top:34px;padding-top:24px;border-top:1px solid rgba(245,208,138,.25);font-size:13px;color:rgba(255,255,255,.6);display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;}

        /* Cookie banner */
        .ob-cookie{position:fixed;left:16px;right:16px;bottom:16px;max-width:760px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:18px 22px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap;z-index:50;}
        .ob-cookie p{margin:0;font-size:15px;color:var(--muted);}
        .ob-cookie a{color:var(--oxblood);}
        .ob-cookie button{font-size:14px;letter-spacing:.08em;text-transform:uppercase;padding:11px 24px;border-radius:6px;border:0;cursor:pointer;background:linear-gradient(135deg,var(--emerald-light),var(--emerald));color:#fff;}


        /* ---- SINGLE-COLUMN (straight, one-page) LAYOUT ---- */
        .ob-hero-inner { grid-template-columns: 1fr !important; text-align: center; justify-items: center; gap: 36px; }
        .ob-hero-sub { margin-left: auto; margin-right: auto; }
        .ob-hero-cta { justify-content: center; }
        .ob-photo { max-width: 560px; width: 100%; }
        .ob-heritage-grid { grid-template-columns: 1fr !important; text-align: center; justify-items: center; gap: 36px; }
        .ob-heritage { max-width: 640px; }
        .ob-grid-3 { grid-template-columns: 1fr !important; max-width: 640px; margin-left: auto; margin-right: auto; }
        .ob-card-grid { grid-template-columns: 1fr !important; justify-items: center; text-align: center; gap: 40px; }
        .ob-card-copy { max-width: 600px; }
        .ob-card-feats { display: inline-block; text-align: left; }
        .ob-rates-grid { grid-template-columns: 1fr !important; max-width: 480px; margin-left: auto; margin-right: auto; }
        .ob-seg-grid { grid-template-columns: 1fr !important; max-width: 420px; margin-left: auto; margin-right: auto; }
        .ob-security-list { margin-left: auto; margin-right: auto; }
        .ob-security-list li { flex-direction: column; gap: 4px; }
        .ob-security-grid { grid-template-columns: 1fr !important; max-width: 640px; margin-left: auto; margin-right: auto; gap: 32px; }
        .ob-security-photo { max-width: 480px; margin: 0 auto; }
        .ob-stat-row { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; gap: 40px; }
        .ob-stat + .ob-stat { border-left: 0; border-top: 1px solid rgba(245,208,138,.3); padding-top: 32px; }
        .ob-testi-grid { grid-template-columns: 1fr !important; max-width: 640px; margin-left: auto; margin-right: auto; }
        .ob-steps { grid-template-columns: 1fr !important; max-width: 460px; margin-left: auto; margin-right: auto; gap: 34px; }
        .ob-contact-grid { grid-template-columns: 1fr !important; max-width: 520px; margin-left: auto; margin-right: auto; text-align: center; gap: 32px; }
        .ob-section { text-align: center; }
        .ob-section .ob-rule { margin-left: auto; margin-right: auto; }
        .ob-lead { margin-left: auto; margin-right: auto; }
        .ob-faq { text-align: left; }
        .ob-security-list { text-align: left; }
        .ob-card-feats li { text-align: left; }

        @media (max-width:860px){
          .ob-nav{display:none;}
          .ob-burger{display:flex;}
          .ob-mobile.show{display:flex;}
          .ob-hero-inner,.ob-heritage-grid,.ob-grid-3,.ob-seg-grid,.ob-stat-row,.ob-steps,.ob-contact-grid,.ob-card-grid,.ob-rates-grid,.ob-testi-grid,.ob-security-grid{grid-template-columns:1fr;}
          .ob-hero h1{font-size:40px;}
          .ob-hero-art{order:-1;}
          .ob-stat+.ob-stat{border-left:0;border-top:1px solid rgba(245,208,138,.3);padding-top:28px;}
          .ob-security-list .ob-k{min-width:auto;display:block;}
          .ob-section h2{font-size:32px;}
        }
        @media (prefers-reduced-motion:reduce){.ob-root *{transition:none!important;}}
      `}</style>

      {/* Header */}
      <div className="ob-topline">
        <header className="ob-header">
          <div className="ob-brand">
            <img src={LOGO_SRC} alt="Oakstone 1 Bank seal" />
            <div>
              <div className="ob-brand-name">Oakstone 1 Bank</div>
              <div className="ob-brand-sub">Established MCMXIV</div>
            </div>
          </div>
          <nav className="ob-nav">
            <a href="#services">Services</a>
            <a href="#heritage">Heritage</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
            <a href="/register" className="ob-open">Open Account</a>
            <a href="/login" className="ob-signin">Sign in</a>
          </nav>
          <button className="ob-burger" aria-label="Menu" onClick={() => setMenuOpen((m) => !m)}>
            <span></span><span></span><span></span>
          </button>
        </header>
        <nav className={"ob-mobile" + (menuOpen ? " show" : "")}>
          <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
          <a href="#heritage" onClick={() => setMenuOpen(false)}>Heritage</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
          <a href="/register" onClick={() => setMenuOpen(false)}>Open Account</a>
          <a href="/login" onClick={() => setMenuOpen(false)}>Sign in</a>
        </nav>
      </div>

      {/* Hero */}
      <section className="ob-hero">
        <div className="ob-hero-inner">
          <div>
            <p className="ob-eyebrow">A century of financial heritage</p>
            <h1>Built on Legacy.<br />Secured by Trust.</h1>
            <p className="ob-hero-sub">
              Oakstone 1 Bank has safeguarded the savings of individuals, enterprises,
              and families since 1914 — with warmth, discipline, and the permanence
              that lasting institutions are made of.
            </p>
            <div className="ob-hero-cta">
              <a href="/register" className="ob-btn ob-btn-primary">Open an Account</a>
              <a href="#services" className="ob-btn ob-btn-ghost">Explore Services</a>
            </div>
          </div>
          <figure className="ob-photo ob-hero-art">
            <img src={HERO_SRC} alt="A banker reviewing paperwork with clients across a desk" loading="lazy" />
            <figcaption>An account is a handshake that lasts.</figcaption>
          </figure>
        </div>
      </section>

      {/* Heritage */}
      <section className="ob-section ob-alt" id="heritage">
        <div className="ob-wrap ob-heritage-grid">
          <div className="ob-heritage">
            <p className="ob-eyebrow">Our heritage</p>
            <hr className="ob-rule" />
            <h2>A tradition of financial strength.</h2>
            <p style={{ marginTop: 16 }}>We were founded on a simple conviction: that a bank is a custodian first. Where others chase the moment, we are built for permanence — measured in decades, not quarters.</p>
            <p>Drawing on the traditions of America's enduring financial institutions, Oakstone 1 Bank practices a philosophy of long-term wealth preservation.</p>
            <p>The oak on our seal is no ornament. It is the standard we hold ourselves to: rooted, deliberate, and stronger with every passing year.</p>
          </div>
          <div className="ob-heritage-visual">
            <img className="ob-heritage-photo" src={HERITAGE_SRC} alt="Oakstone 1 Bank heritage" />
            <div className="ob-heritage-seal">
              <img src={LOGO_SRC} alt="Oakstone 1 Bank seal" />
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="ob-section" id="services">
        <div className="ob-wrap">
          <p className="ob-eyebrow">What we offer</p>
          <hr className="ob-rule" />
          <h2>Services</h2>
          <p className="ob-lead">Everything you bank with us, conducted with one standard of care.</p>
          <div className="ob-grid-3">
            {services.map((s, i) => (
              <a className="ob-card" key={s.name} href="/register">
                <span className="ob-idx">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.name}</h3>
                <p>{s.body}</p>
                <span className="ob-card-link">Open an account &rarr;</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Reserve card */}
      <section className="ob-section ob-card-section">
        <div className="ob-wrap">
          <p className="ob-eyebrow">The card you carry</p>
          <hr className="ob-rule" />
          <h2>The Oakstone Reserve Card.</h2>
          <div className="ob-card-grid">
            <div className="ob-card-copy">
              <p>One card, carried with the same quiet confidence as the institution behind it. No gimmicks — only the assurance of a bank that has kept its word for over a century.</p>
              <ul className="ob-card-feats">
                <li>Freeze and unfreeze instantly from your dashboard</li>
                <li>Real-time fraud monitoring on every transaction</li>
                <li>Accepted worldwide, backed by Oakstone</li>
              </ul>
              <a href="/register" className="ob-cc-cta">Apply for the card</a>
            </div>
            <ReserveCard />
          </div>
        </div>
      </section>

      {/* Rates */}
      <section className="ob-section">
        <div className="ob-wrap">
          <p className="ob-eyebrow">Today's rates</p>
          <hr className="ob-rule" />
          <h2>Rates that reward patience.</h2>
          <p className="ob-lead">Competitive yields, held to the same standard of stability as everything else we do.</p>
          <div className="ob-rates-grid">
            {rates.map((r) => (
              <div className="ob-rate" key={r.label}>
                <div className="ob-rate-val">{r.value}</div>
                <div className="ob-rate-label">{r.label}</div>
                <div className="ob-rate-note">{r.note}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 18 }}>Rates shown are illustrative and subject to change. Annual Percentage Yields (APY) accurate as of the date of publication.</p>
        </div>
      </section>

      {/* Segments */}
      <section className="ob-section ob-segments">
        <div className="ob-wrap">
          <p className="ob-eyebrow">Whom we serve</p>
          <hr className="ob-rule" />
          <h2>Clients of every standing.</h2>
          <p className="ob-lead">One standard of stewardship, extended to all who place their trust with us.</p>
          <div className="ob-seg-grid">
            {segments.map((seg) => (
              <div className="ob-seg" key={seg.title}>
                <div className="ob-seg-photo"><img src={seg.img} alt={seg.title} loading="lazy" /></div>
                <h3>{seg.title}</h3>
                <p>{seg.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="ob-section" id="security">
        <div className="ob-wrap">
          <p className="ob-eyebrow">Security &amp; trust</p>
          <hr className="ob-rule" />
          <h2>Your funds, protected without compromise.</h2>
          <div className="ob-security-grid">
            <ul className="ob-security-list">
              <li><span className="ob-k">Secure infrastructure</span><span className="ob-v">Every account is held on hardened, continuously audited banking systems.</span></li>
              <li><span className="ob-k">Fraud protection</span><span className="ob-v">Transactions are screened in real time, with suspicious activity halted before it settles.</span></li>
              <li><span className="ob-k">Account monitoring</span><span className="ob-v">Round-the-clock oversight and immediate alerts keep you informed of every movement.</span></li>
              <li><span className="ob-k">Card controls</span><span className="ob-v">Freeze any card the instant it leaves your sight, and lift the hold just as quickly.</span></li>
            </ul>
            <div className="ob-security-photo"><img src="/security.jpg" alt="Digital security" loading="lazy" /></div>
          </div>
        </div>
      </section>

      {/* Strength */}
      <section className="ob-section ob-strength">
        <div className="ob-wrap">
          <div className="ob-stat-row">
            <div className="ob-stat"><div className="ob-num">110+</div><span className="ob-cap">Years of tradition</span></div>
            <div className="ob-stat"><div className="ob-num">$48B</div><span className="ob-cap">Assets under stewardship</span></div>
            <div className="ob-stat"><div className="ob-num">1914</div><span className="ob-cap">Year of founding</span></div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="ob-section ob-testi">
        <div className="ob-wrap">
          <p className="ob-eyebrow">In their words</p>
          <hr className="ob-rule" />
          <h2>Trusted across generations.</h2>
          <div className="ob-testi-grid">
            {testimonials.map((t) => (
              <div className="ob-testi-card" key={t.name}>
                <div className="q">&ldquo;{t.quote}&rdquo;</div>
                <div className="ob-testi-person">
                  <img className="ob-testi-avatar" src={t.img} alt={t.name} loading="lazy" />
                  <div>
                    <div className="n">{t.name}</div>
                    <div className="r">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ob-section" id="faq">
        <div className="ob-wrap">
          <p className="ob-eyebrow" style={{ textAlign: "center" }}>Questions</p>
          <h2 style={{ textAlign: "center" }}>Frequently asked.</h2>
          <div className="ob-faq">
            {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="ob-section ob-alt" id="how">
        <div className="ob-wrap">
          <p className="ob-eyebrow">Getting started</p>
          <hr className="ob-rule" />
          <h2>How it works.</h2>
          <p className="ob-lead">Opening an account takes about five minutes — and everything after is just as simple.</p>
          <div className="ob-steps">
            <div className="ob-step">
              <div className="ob-step-num">1</div>
              <h3>Open an account</h3>
              <p>Tell us a few details and verify your identity. Most applications are reviewed within one business day.</p>
            </div>
            <div className="ob-step">
              <div className="ob-step-num">2</div>
              <h3>Fund it securely</h3>
              <p>Add money by transfer the moment you're approved. Your balance is protected from the first cent.</p>
            </div>
            <div className="ob-step">
              <div className="ob-step-num">3</div>
              <h3>Bank from anywhere</h3>
              <p>Send money, manage cards, and track every transaction — any hour, from any device. No branch required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="ob-section ob-cta">
        <div className="ob-wrap">
          <h2>Your future deserves a permanent home.</h2>
          <p>Join the clients who have trusted Oakstone 1 Bank for over a century. Opening an account takes only a few minutes.</p>
          <a href="/register" className="ob-cta-btn">Open an Account</a>
        </div>
      </section>

      {/* Contact */}
      <section className="ob-section" id="contact">
        <div className="ob-wrap">
          <p className="ob-eyebrow">Support</p>
          <hr className="ob-rule" />
          <h2>At your service.</h2>
          <div className="ob-contact-grid">
            <div><h3>By correspondence</h3><p><a href="mailto:support@oaskstoneone.com">support@oaskstoneone.com</a><br />Replies within one business day.</p></div>
            <div><h3>Headquarters</h3><p>Oakstone 1 Bank, Financial District.<br />Correspondence by appointment.</p></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="ob-footer">
        <div className="ob-wrap">
          <div className="ob-footer-top">
            <div className="ob-brand">
              <img src={LOGO_SRC} alt="Oakstone 1 Bank seal" />
              <div>
                <div className="ob-brand-name">Oakstone 1 Bank</div>
                <div className="ob-brand-sub">Established MCMXIV</div>
              </div>
            </div>
            <nav className="ob-footer-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
              <a href="/cookies">Cookie Policy</a>
              <a href="/disclosures">Risk Disclosure</a>
            </nav>
          </div>
          <div className="ob-footer-legal">
            <span>© 2000–2026 Oakstone 1 Bank. All rights reserved.</span>
            <span>Member, Federal Deposit Insurance Corporation · Equal Housing Lender</span>
          </div>
        </div>
      </footer>

      {/* Cookie banner */}
      {!cookieOk && (
        <div className="ob-cookie">
          <p>We use essential cookies to operate this site. See our <a href="/cookies">Cookie Policy</a>.</p>
          <button onClick={() => setCookieOk(true)}>Accept</button>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
