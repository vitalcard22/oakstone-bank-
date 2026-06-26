// Oakstones 1 Bank â€” Cookie Policy
// IMPORTANT: This is a generic template, NOT legal advice. Have a lawyer review
// before publishing on a real financial institution's site.
// Wire to its route (e.g. <Route path="/cookies" element={<CookiePolicy />} />).

import React from "react";

const CookiePolicy: React.FC = () => {
  return (
    <div style={{ fontFamily: "'EB Garamond', Georgia, serif", background: "#fff", color: "#33322C", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 32px" }}>
        <a href="/" style={{ color: "#C08A2D", textDecoration: "none", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>&larr; Back to home</a>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 44, margin: "18px 0 6px" }}>Cookie Policy</h1>
        <p style={{ color: "#5C5A4F", fontSize: 14, marginBottom: 32 }}>Last updated: January 2026</p>
        <div style={{ fontSize: 17, lineHeight: 1.7 }}>
          <p>This Cookie Policy explains how Oakstones 1 Bank uses cookies and similar technologies on our website.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>What Are Cookies</h2>
          <p>Cookies are small text files stored on your device that help us operate our website securely and remember your preferences.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Cookies We Use</h2>
          <p>We use essential cookies required for secure login and core functionality. We use these only as necessary to provide our services and protect your account.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Note that disabling essential cookies may prevent you from logging in or using certain features.</p>
        </div>
        <p style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E9E3D4", fontSize: 13, color: "#5C5A4F" }}>
          Â© 2000â€“2026 Oakstones 1 Bank. All rights reserved. This document is provided for general informational purposes and does not constitute legal advice.
        </p>
      </div>
    </div>
  );
};

export default CookiePolicy;
