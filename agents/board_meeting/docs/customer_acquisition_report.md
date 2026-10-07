# Meridian Technologies — Customer Acquisition & Retention Report

**Prepared by:** VP of Sales, Derek Haines & VP of Customer Success, Priya Venkatesh
**Period:** Q2 2026
**Classification:** Board Confidential

---

## Executive Summary

Q2 2026 was a strong quarter for new customer acquisition, with 65 net new customers (highest ever). Enterprise new logo acquisition was particularly strong at 4 new accounts. However, retention metrics continued their downward trend for the third consecutive quarter, driven by the Atlas 4.0 delay and competitive pressure from Pinnacle Systems.

The sales pipeline is healthy at $34.7M in potential ARR across 47 active opportunities, but the concentration of large deals in early stages creates execution risk.

---

## New Customer Acquisition

### Q2 Summary

| Metric                         | Q1 2026 | Q2 2026 | QoQ Change |
| ------------------------------ | ------- | ------- | ---------- |
| New Customers                  | 49      | 65      | +32.7%     |
| New Enterprise (>$500K ARR)    | 4       | 4       | 0%         |
| New Mid-Market ($100-500K ARR) | 18      | 24      | +33.3%     |
| New SMB (<$100K ARR)           | 27      | 37      | +37.0%     |
| New Logo ARR                   | $7.2M   | $9.8M   | +36.1%     |
| Average New Deal Size          | $147K   | $151K   | +2.7%      |
| Sales Cycle Length (avg)       | 68 days | 72 days | +5.9%      |

### New Enterprise Wins — Detail

**1. Crestview Media Holdings — $2.2M ARR**

- Contact: Tyler Zhong, VP Data & Analytics
- Product: Atlas Platform (upsell from $400K Beacon-only to full platform)
- Sales Cycle: 94 days
- Competitive: Replaced Tableau
- Notes: This was technically an upsell/expansion but represents a new platform deployment. The customer started with Beacon Analytics standalone 8 months ago and expanded to the full Atlas platform after seeing ROI in their media performance analytics.

**2. Zenith Telecom — $1.35M ARR**

- Contact: Adaeze Nwosu, CTO
- Product: Atlas Platform + Beacon Analytics
- Sales Cycle: 112 days
- Competitive: Beat Pinnacle Systems in final evaluation
- Notes: Network performance analytics use case. Pinnacle was the leading contender until late in the process — Zenith's security team required on-premises deployment for their network data, which Pinnacle couldn't offer. Our integration with their existing Ericsson OSS/BSS stack was also a differentiator.

**3. Ironclad Manufacturing — $750K ARR**

- Contact: Thomas Brennan, Director of Digital Transformation
- Product: Atlas Platform (3-year contract)
- Sales Cycle: 87 days
- Competitive: Replaced legacy SAS installation
- Notes: Manufacturing IoT analytics. Customer committed to a 3-year term in exchange for a 12% volume discount. IoT data volumes are significant — estimated 500GB/day ingestion.

**4. Meridian Shipping — $680K ARR**

- Contact: Yiannis Papadopoulos, Head of Maritime Analytics
- Product: Atlas Platform
- Sales Cycle: 65 days
- Competitive: No significant competition (greenfield)
- Notes: Maritime logistics analytics. Greek company, EMEA deal. Despite the confusing name overlap, this was a clean win. Short sales cycle due to clear use case and no incumbent.

### Win Rate Trends

| Segment    | Q4 2025 | Q1 2026 | Q2 2026 |
| ---------- | ------- | ------- | ------- |
| Enterprise | 38%     | 42%     | 44%     |
| Mid-Market | 32%     | 35%     | 33%     |
| SMB        | 45%     | 41%     | 39%     |

Enterprise win rate improvement is encouraging and correlates with the Atlas 4.0 pre-release narrative resonating with technical evaluators. Mid-market and SMB win rates declined slightly, consistent with Pinnacle's aggressive mid-market push and Power BI's competitive pressure in SMB.

---

## Customer Retention

### Retention Metrics

| Metric                  | Q4 2025 | Q1 2026 | Q2 2026 | Trend     |
| ----------------------- | ------- | ------- | ------- | --------- |
| Net Revenue Retention   | 115%    | 112%    | 108%    | Declining |
| Gross Revenue Retention | 96.1%   | 95.2%   | 94.8%   | Declining |
| Logo Retention          | 97.8%   | 97.2%   | 96.9%   | Declining |
| Expansion Rate          | 19%     | 17%     | 13%     | Declining |

The retention decline is the most concerning trend in the business. Contributing factors:

1. **Atlas 4.0 delay** — Enterprise customers who were promised real-time capabilities in Q2 saw the timeline slip. Three customers cited this directly in downsell discussions.

2. **Competitive pressure** — Pinnacle Systems is actively targeting our mid-market base. We've identified 8 accounts where Pinnacle has initiated contact or conducted demos in Q2.

3. **Product team vacancy** — Without a VP of Product, feature requests and escalations are taking longer to process. Customer NPS declined from 42 to 38 in Q2.

4. **SMB natural attrition** — SMB customers continue to churn at elevated rates (8.2% annualized), but this is expected as we transition the segment to self-serve.

### At-Risk Enterprise Accounts

| Account                | ARR   | Risk Level | Primary Concern                            | Mitigation                                         |
| ---------------------- | ----- | ---------- | ------------------------------------------ | -------------------------------------------------- |
| Whitfield & Associates | $4.2M | Critical   | Atlas 3.x limitations, evaluating Pinnacle | Dedicated recovery plan, beta access, exec sponsor |
| Hartwell Industries    | $1.8M | High       | Budget cuts, consolidating vendors         | Proposed 3-year commitment discount                |
| NovaTech Solutions     | $920K | Medium     | Feature gap (GraphQL subscriptions)        | Committed to Atlas 4.1 delivery                    |
| Brightmore Financial   | $680K | Medium     | Key champion departed                      | New stakeholder mapping in progress                |
| Westfield Analytics    | $540K | Low-Medium | Price sensitivity                          | Offered annual prepay discount                     |

**Total enterprise ARR at risk: $8.14M** (3.8% of total ARR)

### Whitfield & Associates — Detailed Status

Whitfield & Associates ($4.2M ARR, contract renewal September 30, 2026) remains our highest-priority retention effort. Timeline of events:

- **January 2026:** Whitfield's VP Engineering (Robert Chandra) submits formal complaint about Atlas 3.x dashboard refresh latency (15-second refresh interval vs. their requirement for real-time)
- **February 2026:** Whitfield begins evaluating Pinnacle Systems
- **March 2026:** Meridian assigns dedicated customer success team; David Park conducts executive-to-executive call with Whitfield's CEO (Margaret Whitfield)
- **April 2026:** Whitfield reduces active seat count from 1,200 to 840 (30% reduction), triggering revenue contraction
- **May 2026:** Atlas 4.0 delay announced; Whitfield expresses "serious disappointment" (email from Robert Chandra to Maria Santos)
- **June 2026:** Pinnacle conducts second on-site demo at Whitfield. However, Whitfield also accepts invitation to Atlas 4.0 beta program
- **July 2026:** Atlas 4.0 beta feedback from Whitfield is "cautiously positive." Robert Chandra notes streaming performance meets requirements. Formal QBR scheduled July 22.

**Current assessment:** 65% probability of retention (up from 40% in April). Key remaining concerns from Whitfield:

1. API throughput under production load (testing in beta)
2. Migration effort from 3.x to 4.0 (estimated 4-6 weeks for their custom configurations)
3. Long-term product roadmap confidence (VP of Product vacancy is a concern for them)
4. Pinnacle's offer of 25% Year 1 discount

---

## Sales Pipeline

### Pipeline Summary

| Stage                               | Deals  | Potential ARR   | Weighted ARR    |
| ----------------------------------- | ------ | --------------- | --------------- |
| Discovery                           | 15     | $14,680,000     | $3,524,000      |
| Technical Evaluation                | 11     | $8,225,000      | $4,389,000      |
| Proposal Sent                       | 12     | $6,320,000      | $3,456,000      |
| Security Review                     | 4      | $11,970,000     | $7,845,000      |
| Contract Negotiation                | 3      | $3,155,000      | $2,546,000      |
| Closed Won (pending implementation) | 2      | $405,000        | $405,000        |
| **Total**                           | **47** | **$34,755,000** | **$22,165,000** |

_Note: Weighted ARR = Potential ARR x probability. See sales_pipeline.csv for full deal-level detail._

### Top 5 Pipeline Deals

1. **GlobalTech Industries — $8.5M potential ARR**
   - Stage: Security Review (75% probability)
   - Product: Atlas Platform + Beacon Analytics
   - Expected Close: August 15, 2026
   - Notes: Our largest deal ever if it closes. Champion is Marcus Webb (CTO). Security team reviewing data residency requirements. Competitive with Pinnacle Systems — GlobalTech has narrowed to a final two evaluation. Key differentiator: our 180+ connectors vs. Pinnacle's 43 (GlobalTech has SAP, Workday, and Salesforce that all need integration).

2. **Federated Health Systems — $5.1M potential ARR**
   - Stage: Technical Evaluation (60% probability)
   - Product: Atlas Platform
   - Expected Close: September 1, 2026
   - Notes: Healthcare vertical requiring HIPAA compliance. Running POC with 3 departments. Replacing legacy Oracle BI. 6-month migration timeline. Dr. Nina Chowdhury is champion.

3. **Archer Defense Corp — $4.3M potential ARR**
   - Stage: Proposal Sent (50% probability)
   - Product: Atlas Platform
   - Expected Close: July 30, 2026
   - Notes: Federal/defense sector. Requires FedRAMP authorization — currently in progress. Competing against Palantir. Also requires air-gapped deployment option (Atlas 4.1 feature). May need to accelerate air-gap timeline to close this deal.

4. **Northvale Insurance Group — $3.8M potential ARR**
   - Stage: Discovery (30% probability)
   - Product: Atlas Platform
   - Expected Close: October 15, 2026
   - Notes: Insurance vertical. Needs actuarial data integration. Early stage — just completed initial demo. Interested in Beacon Analytics add-on for claims anomaly detection.

5. **Commonwealth Banking Partners — $3.1M potential ARR**
   - Stage: Discovery (20% probability)
   - Product: Atlas Platform
   - Expected Close: December 1, 2026
   - Notes: Australian bank, APAC expansion target. Very early stage. Yuki Tanaka managing relationship. Complex regulatory environment (APRA compliance). Potential anchor customer for Australia.

### Pipeline by Product

| Product               | Deals | Potential ARR |
| --------------------- | ----- | ------------- |
| Atlas Platform only   | 27    | $21,205,000   |
| Beacon Analytics only | 12    | $4,490,000    |
| Atlas + Beacon bundle | 8     | $9,060,000    |

The bundled Atlas + Beacon deals average $1.13M in potential ARR vs. $785K for Atlas-only and $374K for Beacon-only. The cross-sell strategy is working for larger deals.

### Pipeline by Segment

| Segment                | Deals | Potential ARR |
| ---------------------- | ----- | ------------- |
| Enterprise (>$500K)    | 14    | $25,780,000   |
| Mid-Market ($100-500K) | 21    | $7,510,000    |
| SMB (<$100K)           | 12    | $1,465,000    |

Enterprise pipeline concentration is high — 74% of pipeline value is in 14 enterprise deals. If the top 3 deals (GlobalTech, Federated Health, Archer Defense) all close, it would represent $17.9M in new ARR — transformative for Q3/Q4.

---

## Sales Team Performance

### Team Composition

- Enterprise AEs: 14 (target: 16 — 2 positions open)
- Mid-Market AEs: 22 (fully staffed)
- SMB AEs: 22 (reducing to 6 per self-serve migration plan)
- APAC Sales: 5 (VP + 4 reps; target: 10 by Q4)
- Sales Engineering: 18 (target: 22)
- SDRs/BDRs: 28 (fully staffed)
- Total Sales Organization: 109

### Quota Attainment (Q2)

- Enterprise team: 118% of quota (carried by Crestview Media and Zenith Telecom wins)
- Mid-Market team: 94% of quota
- SMB team: 87% of quota (expected decline per strategy)
- APAC team: N/A (ramping, no Q2 quota)
- **Overall: 102% of quota**

### Key Hires Needed

1. 2 Enterprise AEs — one for healthcare vertical, one for federal/defense (critical for Federated Health and Archer Defense pursuits)
2. 4 APAC reps — 2 for Australia, 2 for Japan (per expansion plan)
3. 4 Sales Engineers — demand exceeds capacity by ~30%; SEs are the bottleneck for POC execution
