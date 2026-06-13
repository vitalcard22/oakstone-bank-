// Oakstone 1 Bank — Privacy Policy
// IMPORTANT: This is a generic template, NOT legal advice. Have a lawyer review
// before publishing on a real financial institution's site.
// Wire to its route (e.g. <Route path="/privacy" element={<PrivacyPolicy />} />).

import React from "react";

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ fontFamily: "'EB Garamond', Georgia, serif", background: "#fff", color: "#33322C", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 32px" }}>
        <a href="/" style={{ color: "#C08A2D", textDecoration: "none", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>&larr; Back to home</a>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 44, margin: "18px 0 6px" }}>Privacy Policy</h1>
        <p style={{ color: "#5C5A4F", fontSize: 14, marginBottom: 32 }}>Last updated: January 2026</p>
        <div style={{ fontSize: 17, lineHeight: 1.7 }}>
          <p>Oakstone 1 Bank ("we," "us," or "the Bank") is committed to protecting the privacy of our clients. This policy describes how we collect, use, and safeguard your personal information.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Information We Collect</h2>
          <p>We collect information you provide when opening an account, including your name, contact details, government identification, and financial information necessary to provide banking services.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>How We Use Your Information</h2>
          <p>Your information is used to operate your accounts, process transactions, prevent fraud, comply with legal obligations, and communicate with you about your banking relationship.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>How We Protect It</h2>
          <p>We employ bank-grade encryption, continuous monitoring, and strict access controls to protect your information. We do not sell your personal information.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal information, subject to legal and regulatory retention requirements. Contact us at privacy@oakstoneone.com.</p>
        </div>
        <p style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E9E3D4", fontSize: 13, color: "#5C5A4F" }}>
          © 2000–2026 Oakstone 1 Bank. All rights reserved. This document is provided for general informational purposes and does not constitute legal advice.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
