# Meridian Technologies — Legal & Compliance Report

**Prepared by:** Thomas Wright, General Counsel
**Period:** H1 2026 (January 1 — June 30, 2026)
**Classification:** Attorney-Client Privileged & Board Confidential

---

## 1. Patent Litigation: Pinnacle Systems v. Meridian Technologies

### Case Summary

- **Case:** Pinnacle Systems, Inc. v. Meridian Technologies, Inc.
- **Court:** United States District Court, Northern District of California
- **Case No.:** 3:26-cv-01847-MS
- **Judge:** Hon. Margaret Santos
- **Filed:** February 12, 2026
- **Meridian's Response Filed:** April 30, 2026

### Patent at Issue

- **US Patent No. 11,847,293** — "Method and System for Distributed Real-Time Data Stream Processing"
- **Filed by Pinnacle:** January 14, 2021
- **Issued:** March 8, 2022
- **Key Claims:** The patent broadly claims a method for distributing real-time data stream processing across multiple computing nodes with automatic load balancing and fault tolerance. Pinnacle alleges that Atlas's real-time analytics processing infringes Claims 1, 4, 7, and 12.

### Meridian's Defense Strategy

**Primary Defense: Prior Art Invalidity**
Atlas 2.0 was released on September 12, 2019 — 16 months before Pinnacle's patent application filing date. Atlas 2.0 included distributed data processing with load balancing across nodes. Our engineering team has preserved the complete technical documentation, source code commits, and marketing materials from the Atlas 2.0 launch that demonstrate prior art.

Specifically:

- Git commit history showing distributed stream processing code merged August 3, 2019
- Atlas 2.0 technical whitepaper published on our engineering blog September 5, 2019
- Conference presentation at KDD 2019 (August 4-8, 2019) by Anil Gupta demonstrating the distributed processing architecture
- Three customer deployments using distributed stream processing went live in Q4 2019

**Secondary Defense: Non-Infringement**
Atlas 4.0's real-time streaming uses an event-sourced architecture fundamentally different from the batch-micro-batch method described in the patent. The patent describes a "central coordinator node" that distributes work to processing nodes — Atlas 4.0 uses a peer-to-peer event log (similar to Apache Kafka's architecture) with no central coordinator.

**Secondary Defense: Patent Eligibility (Alice/Section 101)**
The claimed method may be an abstract idea implemented on generic computer hardware, potentially making it ineligible for patent protection under the Alice Corp. v. CLS Bank framework. This is a weaker argument but provides additional grounds.

### Litigation Timeline

| Date         | Event                                       | Status          |
| ------------ | ------------------------------------------- | --------------- |
| Feb 12, 2026 | Complaint filed                             | Complete        |
| Apr 30, 2026 | Meridian answer + counterclaims filed       | Complete        |
| May 15, 2026 | Initial case management conference          | Complete        |
| Jun 1, 2026  | Discovery begins                            | In progress     |
| Jun 20, 2026 | Pinnacle motion to expedite Markman hearing | Denied (Jun 28) |
| Aug 15, 2026 | Markman hearing (claim construction)        | Scheduled       |
| Oct 31, 2026 | Fact discovery closes                       | Scheduled       |
| Jan 15, 2027 | Expert discovery closes                     | Scheduled       |
| Apr 2027     | Trial (if no settlement)                    | Estimated       |

### Discovery Status

- Pinnacle has requested extensive documentation of Atlas 2.0 and 3.0 architecture (2019-2024)
- Document production is approximately 40% complete
- Pinnacle deposed Anil Gupta on June 18; deposition was uneventful — Anil demonstrated detailed knowledge of prior art
- Meridian has requested Pinnacle's patent prosecution history and internal communications regarding awareness of Atlas 2.0 prior art before filing; Pinnacle is resisting production, claiming privilege
- **Key question for Markman hearing:** Whether "distributed real-time data stream processing" in the patent claims is limited to the specific batch-micro-batch method described in the specification, or broadly covers any distributed stream processing

### Financial Exposure

- **Legal spend to date:** $1.3M ($410K in Q1, $890K in Q2)
- **Estimated total cost through trial:** $3-5M (updated from $2-4M due to broader discovery scope)
- **Maximum damages exposure if found infringing:** $8-15M (based on reasonable royalty analysis of Atlas revenue attributable to real-time processing features)
- **Injunction risk:** Low probability (estimated 10-15%). Even if Pinnacle wins, courts rarely grant injunctions for software patents post-eBay v. MercExchange. More likely outcome would be ongoing royalty.
- **Settlement range (if pursued):** Estimated $2-4M one-time payment or $500K-1M annual licensing fee

### Recommendation

Continue with the current strategy of vigorous defense based on prior art. Do not initiate settlement discussions before the Markman hearing (August 15). The Markman ruling will significantly impact both parties' assessment of the case strength and likely drive more productive settlement discussions.

### Pinnacle's Litigation Counsel

- **Firm:** Kirkland & Ellis LLP
- **Lead Partner:** Karen Whitfield (no relation to Whitfield & Associates)
- **Assessment:** Well-funded litigation effort consistent with Pinnacle's Series D raise. They appear willing to spend to establish patent enforcement precedent.

---

## 2. Regulatory Compliance

### SOC 2 Type II Audit

- **Auditor:** Deloitte & Touche LLP
- **Audit Period:** January 1, 2025 — December 31, 2025
- **Report Issued:** March 15, 2026
- **Opinion:** Unqualified (clean) with one observation

**Finding Detail:**
Data retention policies for customer analytics data were not consistently enforced across all production environments. Specifically:

- Three legacy staging environments (staging-us-west-1, staging-eu-west-1, staging-ap-southeast-1) retained customer data beyond the 90-day retention window specified in customer data processing agreements
- The staging environments were used for QA testing and contained copies of production data from 14 customer accounts
- Data retention in these environments ranged from 120 to 187 days (vs. 90-day contractual limit)
- Root cause: automated data lifecycle management was only configured for production environments; staging environments were excluded from the automation scope when it was deployed in 2024

**Remediation:**

- Engineering deployed automated data lifecycle management across all environments (production, staging, development) by March 28, 2026
- Conducted a comprehensive audit of all environments to confirm no other data retention violations
- Implemented monitoring alerts for any data exceeding retention thresholds
- Added staging environments to quarterly compliance review checklist
- Thomas confirmed remediation was complete before Deloitte finalized the report; the finding is noted as "remediated" in the SOC 2 report

**Customer Impact:**

- The 14 affected customer accounts were notified per our data breach notification procedures
- No actual data breach occurred — the data was in secured staging environments with access controls
- Two customers (including Whitfield & Associates) requested written confirmation of remediation
- No customers terminated contracts or sought damages as a result

### CPRA Compliance Audit

- **Auditor:** Ernst & Young LLP
- **Audit Completed:** June 10, 2026
- **Result:** Compliant with two recommendations

**Recommendations:**

1. **Cookie Consent Mechanism:** Update the cookie consent banner to include granular opt-out options for analytics cookies (currently only offers all-or-nothing consent). Implementation estimate: 2 weeks. Assigned to frontend team.
2. **Data Subject Request Tracking:** Improve the internal dashboard for tracking data subject access requests (DSARs) to include SLA countdown timers and automated escalation for requests approaching the 45-day statutory deadline. Implementation estimate: 1 week. Assigned to compliance engineering team.

Both recommendations accepted by management. Implementation targeted for completion by August 1, 2026.

### GDPR Compliance

- **Data Subject Access Requests (DSARs):**
  - Q1 2026: 47 requests (all completed within 30-day statutory period)
  - Q2 2026: 52 requests (all completed within 30-day statutory period)
  - Average response time: 12 days (improved from 16 days in Q4 2025)
  - No requests escalated to supervisory authorities

- **Data Processing Agreements (DPAs):**
  - 100% of enterprise and mid-market customers have executed DPAs
  - 89% of SMB customers have acknowledged standard DPA terms (up from 82%)
  - Updated standard DPA to reflect Schrems II requirements for EU-US data transfers

- **EU Representative:** Appointed Meridian Technologies EU B.V. (Amsterdam) as Article 27 representative

### HIPAA Compliance

- Business Associate Agreements (BAAs) in place with all 8 healthcare customers
- Annual HIPAA risk assessment completed May 2026 by Coalfire
- No findings requiring immediate remediation
- Recommended: additional encryption for data at rest in the healthcare-specific data partition (AES-256 is current standard; recommending customer-managed encryption keys). Implementation planned for Atlas 4.1.

### FedRAMP Authorization

- **Status:** Application preparation in progress
- **Target:** FedRAMP Moderate authorization by Q4 2026
- **3PAO Selected:** Schellman & Company (assessment organization)
- **Current Phase:** System Security Plan (SSP) documentation (approximately 60% complete)
- **Key Milestones:**
  - SSP completion: August 2026
  - 3PAO assessment: September-October 2026
  - JAB review submission: November 2026
  - Expected authorization: Q1 2027 (slipped from original Q4 2026 target)
- **Impact:** Three active deals require FedRAMP (Archer Defense $4.3M, Falcon Aerospace $1.75M, Trident Naval $1.9M). Combined potential ARR: $7.95M. None can close without authorization.
- **Risk:** FedRAMP timeline slip from Q4 2026 to Q1 2027 delays revenue recognition for defense deals by one quarter.

---

## 3. Intellectual Property Portfolio

### Patent Portfolio Summary

- **Issued Patents:** 31
- **Pending Applications:** 12 (3 new in Q2 2026)
- **Key Areas:** Data analytics processing, visualization, anomaly detection, data federation

### Q2 2026 New Applications

1. **"Adaptive Query Optimization for Multi-Tenant Analytics Platforms"**
   - Application No. 18/432,891
   - Filed: May 3, 2026
   - Inventors: Anil Gupta, Marcus Chen, Dr. Wei Li
   - Related to Atlas 4.0's new query engine ("Sequoia")

2. **"Machine Learning-Based Anomaly Detection in Time-Series Business Data"**
   - Application No. 18/445,223
   - Filed: May 22, 2026
   - Inventors: Dr. Sarah Kim, Dr. James Okafor (no relation to board member), Priya Sundaram
   - Core technology for Beacon 2.0

3. **"Cross-Platform Data Mesh Federation Protocol"**
   - Application No. 18/461,557
   - Filed: June 15, 2026
   - Inventors: Anil Gupta, Staff Engineer Liam O'Connor
   - Protects Atlas 4.0's data federation capability

### Trademark Status

- "Meridian" — Registered (US, EU, Japan, Australia)
- "Atlas" — Registered (US, EU); application pending (Japan, Australia)
- "Beacon" — Registered (US, EU) as of Q2 2026; application pending (Japan, Australia)
- "Sequoia" (query engine codename) — Not registered; may conflict with existing marks. Recommend using as internal codename only, not as product name.

---

## 4. D&O Insurance

- **Policy Period:** March 1, 2026 — February 28, 2027
- **Carrier:** Hartford Financial Services Group
- **Annual Premium:** $2.4M (up 12% from prior year)
- **Aggregate Coverage:** $50M
- **Retention (deductible):** $1M per claim
- **Side A DIC (difference in conditions):** $15M (covers directors and officers when company cannot indemnify)
- **Claims-made policy:** Covers claims made during the policy period for wrongful acts occurring during or before the policy period

**Adequacy Assessment:** Coverage is adequate for current risk profile. The patent litigation with Pinnacle would be covered under the IP litigation endorsement if directors/officers are named personally (currently only the company is named). Thomas recommends reviewing coverage adequacy if the company's valuation changes significantly (e.g., in connection with an IPO or financing round).

---

## 5. Employment Law

### Active Matters

1. **Former Sales Director Settlement:** Resolved in Q1 for $185K. NDA in place. No ongoing exposure.
2. **Wage & Hour Review:** Proactive audit of California exempt classifications completed April 2026. Two customer success roles reclassified as non-exempt; back pay adjustment of $34K paid. No litigation risk.
3. **Kevin Park Non-Compete:** Kevin Park (Staff Engineer) departed June 12 for Pinnacle Systems. His employment agreement includes a 6-month non-compete clause, but California law (Business and Professions Code Section 16600) generally prohibits enforcement of non-competes. We are relying on the NDA and trade secret protections (Defend Trade Secrets Act) instead. Thomas is monitoring for any Pinnacle product changes that suggest use of Meridian trade secrets.

### Upcoming Considerations

- **SMB Sales Team Reduction:** The self-serve migration will result in 8 layoffs (pending board approval). Thomas has prepared severance agreements and WARN Act analysis (not triggered — fewer than 50 employees affected at single site). Estimated severance cost: $620K.
- **APAC Employment Law:** Engaged local counsel in Australia (Herbert Smith Freehills) and Japan (Anderson Mori & Tomotsune) for employment law compliance in new offices. Key differences from US: mandatory superannuation in Australia (11.5%), stricter termination protections in Japan.

---

## 6. Risk Register Update

| Risk                                        | Likelihood   | Impact                    | Current Status         | Mitigation                                |
| ------------------------------------------- | ------------ | ------------------------- | ---------------------- | ----------------------------------------- |
| Pinnacle patent litigation — adverse ruling | Low (25%)    | High ($8-15M)             | Active litigation      | Prior art defense; Markman hearing August |
| Data breach / security incident             | Low (10%)    | Critical                  | No incidents YTD       | SOC 2, penetration testing, insurance     |
| Regulatory fine (GDPR/CPRA)                 | Low (5%)     | Medium ($1-5M)            | Compliant per audits   | Continuous monitoring, DPA coverage       |
| Key employee departure to competitor        | Medium (40%) | Medium                    | Kevin Park to Pinnacle | NDA monitoring, retention programs        |
| FedRAMP delay impacts defense deals         | Medium (50%) | High ($7.95M ARR at risk) | Behind schedule        | Accelerated SSP completion, 3PAO engaged  |
| Customer data retention violation           | Low (5%)     | Medium                    | Remediated             | Automated lifecycle management deployed   |
| D&O coverage inadequacy                     | Low (5%)     | High                      | Adequate per review    | Annual assessment, broker monitoring      |
