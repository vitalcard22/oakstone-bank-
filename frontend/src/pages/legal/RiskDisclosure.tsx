// Oakstones 1 Bank — Risk Disclosure
// IMPORTANT: This is a generic template, NOT legal advice. Have a lawyer review
// before publishing on a real financial institution's site.
// Wire to its route (e.g. <Route path="/disclosures" element={<RiskDisclosure />} />).

import React from "react";

const RiskDisclosure: React.FC = () => {
  return (
    <div style={{ fontFamily: "'EB Garamond', Georgia, serif", background: "#fff", color: "#33322C", minHeight: "100vh" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "64px 32px" }}>
        <a href="/" style={{ color: "#C08A2D", textDecoration: "none", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>&larr; Back to home</a>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 44, margin: "18px 0 6px" }}>Risk Disclosure</h1>
        <p style={{ color: "#5C5A4F", fontSize: 14, marginBottom: 32 }}>Last updated: January 2026</p>
        <div style={{ fontSize: 17, lineHeight: 1.7 }}>
          <p>This Risk Disclosure provides important information about banking products and services offered by Oakstones 1 Bank.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Deposit Insurance</h2>
          <p>Deposits are insured by the Federal Deposit Insurance Corporation (FDIC) up to the maximum amount permitted by law. Amounts in excess of insured limits are not protected by FDIC insurance.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Lending Products</h2>
          <p>Loans and credit products are subject to credit approval. Interest rates, fees, and terms vary based on creditworthiness and market conditions. Borrowing carries the obligation of repayment.</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1F6B4A", fontSize: 26, marginTop: 28 }}>Rates and Yields</h2>
          <p>Annual Percentage Yields (APY) shown are illustrative, subject to change without notice, and not guaranteed. Past performance does not guarantee future results.</p>
        </div>
        <p style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #E9E3D4", fontSize: 13, color: "#5C5A4F" }}>
          © 2000–2026 Oakstones 1 Bank. All rights reserved. This document is provided for general informational purposes and does not constitute legal advice.
        </p>
      </div>
    </div>
  );
};

export default RiskDisclosure;
