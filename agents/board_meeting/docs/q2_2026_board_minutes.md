# Meridian Technologies — Board of Directors Meeting Minutes

**Date:** July 9, 2026
**Location:** Meridian HQ, 1200 Innovation Drive, San Mateo, CA (Hybrid — Zoom link provided)
**Called to Order:** 9:07 AM PT by Board Chair Patricia Chen

## Attendees

### Board Members Present

- **Patricia Chen** — Board Chair, Managing Partner at Crestfall Ventures
- **James Harrington** — Independent Director, former CEO of DataStream Inc.
- **Linda Nakamura** — Independent Director, Professor of Computer Science at Stanford
- **Robert Okafor** — Independent Director, Managing Director at Thornfield Capital
- **David Park** — CEO & Co-Founder, Meridian Technologies
- **Anil Gupta** — CTO & Co-Founder, Meridian Technologies (Board Observer)

### Management Present

- **Rachel Morrison** — Chief Financial Officer
- **Maria Santos** — Chief Operating Officer
- **Thomas Wright** — General Counsel
- **Yuki Tanaka** — VP of APAC Sales (via Zoom from Sydney)

### Absent

- **Janet Liu** — VP of Product (departed company April 18, 2026)

### Minutes Recorded By

Sophie Andersen, Corporate Secretary

---

## 1. Call to Order and Approval of Previous Minutes

Patricia Chen called the meeting to order at 9:07 AM. Minutes from the April 2 meeting were approved with no corrections.

Patricia opened by acknowledging two significant developments since the last meeting: (a) the departure of VP of Product Janet Liu on April 18, and (b) the delay of the Atlas 4.0 release. She asked David to address both in his report.

## 2. CEO Report — David Park

David Park presented the Q2 2026 operating update.

### Financial Performance

- **Total Revenue:** $52.1M (up 10.1% from Q1's $47.3M — strongest QoQ growth in 8 quarters)
- **ARR:** $212M as of June 30, 2026 (up from $196M, +8.2% QoQ)
- **Gross Margin:** 73.8% (down from 74.2% — continued infrastructure investment)
- **Net Income:** $1.9M (profitable but lower than Q1's $2.8M due to higher OpEx)
- **Cash Position:** $83.7M (down from $89.4M; used for APAC buildout and Singapore datacenter completion)

### Atlas 4.0 Delay

David addressed the Atlas 4.0 delay directly. The original May 15 target was missed due to three factors:

1. **API Gateway Rewrite Complexity:** The new event-sourced streaming architecture required a complete rewrite of the authentication and rate-limiting layers, not just the data processing pipeline as originally scoped. Engineering discovered in late April that the existing auth middleware was incompatible with the new streaming protocol.

2. **VP of Product Departure:** Janet Liu's resignation on April 18 created a leadership vacuum in the product organization. Two senior PMs (Alex Tran and Michelle Dubois) followed within two weeks. This disrupted feature prioritization and QA coordination for the 4.0 release.

3. **Security Vulnerability:** During pre-release security review on May 8, the team discovered a critical vulnerability (CVE-2026-4471) in the new WebSocket implementation that could allow unauthenticated session hijacking. The fix required re-architecting the session management layer.

**New Timeline:** Atlas 4.0 is now targeted for **June 26, 2026** — a 6-week delay from the original May 15 date. As of July 1, engineering reports the build is code-complete and in final QA. Beta testing with 5 enterprise customers began June 15.

**James Harrington** expressed strong concern about the delay and its impact on customer retention, specifically Whitfield & Associates. He noted this was the second time he'd raised concerns about Atlas 4.0 schedule risk and questioned whether the current engineering leadership structure was adequate without a VP of Product.

David responded that Anil Gupta had assumed interim product leadership and that a formal search for a new VP of Product was underway with Spencer Stuart. He anticipated a hire by September.

**Vote on Atlas 4.0 Delay Acceptance:**
Patricia proposed the board formally acknowledge the delay and management's remediation plan.

- Patricia Chen: Aye
- James Harrington: **Nay** (stated he wanted a formal post-mortem presented at next meeting)
- Linda Nakamura: Aye
- Robert Okafor: Aye
- David Park: Abstain (management)
- **Result: Approved 3-1 (Harrington dissenting), management abstaining. Post-mortem to be presented at October meeting per Harrington's request.**

### Customer Metrics

- **Total Customers:** 1,312 (up from 1,247 — 65 net new)
- **Enterprise Customers (>$500K ARR):** 42 (up from 38)
- **Net Revenue Retention Rate:** 108% (down from 112% in Q1)
- **Gross Churn Rate:** 5.2% annualized (up from 4.8%)

David acknowledged the continued decline in net retention and churn metrics. Contributing factors:

- Two mid-market customers churned entirely (combined $1.1M ARR) — both cited product gaps that Atlas 4.0 addresses
- Whitfield & Associates reduced usage by 30% and has formally notified Meridian of intent to evaluate alternatives at contract renewal (September 30, 2026)
- SMB segment continued to contract as expected; self-serve migration plan approved (see below)

**Positive signals:** Four enterprise customers expanded in Q2 (combined $3.8M additional ARR). The GlobalTech Industries deal ($8.5M potential ARR) advanced to security review stage. Beacon Analytics cross-sell pipeline grew to $6.2M.

### Whitfield & Associates Recovery Plan

David presented a detailed recovery plan for the Whitfield account:

- Dedicated executive sponsor: Maria Santos (COO)
- Priority access to Atlas 4.0 beta (activated June 15)
- Custom API throughput allocation: 3x standard enterprise tier
- Quarterly business review with Whitfield's CTO and VP Engineering scheduled for July 22
- Contract amendment offering 15% discount on renewal in exchange for 2-year commitment
- **Estimated cost of retention effort:** $340K in engineering time + $630K in discount revenue = $970K total, versus $4.2M ARR at risk

**Robert Okafor** asked what the probability of retention was. David estimated 65%, up from 40% before the beta access was arranged. He noted that initial feedback from Whitfield's technical team on Atlas 4.0 beta was "cautiously positive."

### Product Update

- Atlas 4.0: Code-complete, in final QA. GA targeted June 26.
- Atlas 3.x: Maintenance mode; final patch (3.9.7) shipped June 1
- Beacon Analytics Q2 revenue: $3.2M (up 78% from Q1's $1.8M)
- Beacon 2.0 (ML anomaly detection): Research phase complete, engineering started; targeted Q4 2026
- VP of Product search: Spencer Stuart retained; shortlist of 4 candidates, interviews beginning late July

### APAC Update — Yuki Tanaka

Yuki Tanaka joined via Zoom from the new Sydney office (opened June 2) to provide an update:

- Sydney team: 9 of 15 planned hires completed; remaining 6 on track for August
- Tokyo: Office lease executed on July 1 (Minato-ku, 4,200 sq ft); hiring begins August per board-approved timeline
- Pipeline: 3 qualified opportunities totaling $7.1M potential ARR
  - Commonwealth Banking Partners ($3.1M) — discovery stage
  - Pacific Rim Logistics ($1.9M) — technical evaluation
  - Obsidian Mining Corp ($2.1M) — discovery stage
- First APAC customer event planned for September in Sydney
- Challenge: Japanese language localization for Atlas is behind schedule; engineering estimates 4 additional weeks needed (now targeting end of Q3)

**Patricia Chen** commended Yuki on the rapid buildout and asked about competitive dynamics in APAC. Yuki responded that Pinnacle Systems has a small but established presence in Australia (estimated 15-20 customers) primarily in financial services. Meridian's advantage is enterprise integration depth — Pinnacle's APAC offering lacks the deep ERP/CRM connectors that enterprise customers require.

## 3. CFO Report — Rachel Morrison

### Revenue Analysis

- Enterprise: $27.3M (up 11.0% QoQ) — strongest quarter ever; 4 new enterprise logos + significant expansions
- Mid-Market: $15.2M (up 4.8% QoQ) — steady growth, 3 deals slipped to Q3
- SMB: $6.4M (flat QoQ) — decline appears to have bottomed; self-serve pilot showing early promise
- Beacon Analytics: $3.2M (up 78% QoQ) — driven by 12 new customers and 6 existing customer expansions

### Operating Expenses — Concern

Rachel flagged operating expense growth as the key financial concern for the quarter:

- **Total OpEx:** $47.0M (up 14.1% from Q1's $41.2M — significantly above the 5-6% target communicated at the Q1 meeting)
- **Engineering:** $19.4M (up 15.5%) — Atlas 4.0 delay required additional contractor spend ($1.8M unbudgeted) plus security remediation costs. Over Q2 budget by $1.5M.
- **Sales & Marketing:** $14.1M (up 13.7%) — APAC buildout ($2.1M in Q2) plus increased enterprise event spend for the annual Meridian Summit conference
- **G&A:** $5.8M (up 11.5%) — legal costs for patent dispute ($890K in Q2, up from $410K in Q1) plus D&O insurance premium increase
- **Customer Success:** $5.5M (up 12.2%) — Whitfield retention effort and additional implementation engineers for enterprise backlog
- **Research:** $2.2M (up 15.8%) — Beacon 2.0 ML team expansion (3 additional researchers hired)

**Total Q2 OpEx exceeded budget by $2.4M.** Rachel attributed $1.5M to Atlas 4.0-related overruns and $0.9M to APAC and legal costs coming in higher than planned.

### Profitability Impact

- **Operating Income:** $5.1M (revenue $52.1M - OpEx $47.0M)
- **Operating Margin:** 9.8% (down from 12.9% in Q1 on higher OpEx)
- **Net Income:** $1.9M after interest, taxes, and one-time items
- If OpEx growth is not contained, Rachel projected the company could return to operating losses by Q4 if revenue growth decelerated

**James Harrington** asked Rachel to present a specific cost containment plan at the next meeting. Rachel committed to a detailed plan covering: (a) Atlas 4.0 contractor wind-down saving $1.2M/quarter, (b) hiring freeze in G&A through year-end, and (c) APAC spend gating tied to pipeline milestones.

**Robert Okafor** asked about the rule of 40. Rachel stated the current score was 34 (10.1% QoQ growth annualized + ~24% operating margin proxy) — below the 40 threshold. She noted this was the lowest score in 3 quarters and that revenue acceleration needed to outpace OpEx growth to recover.

### Cash Position

- Cash: $83.7M (down from $89.4M)
- Operating cash flow: $2.8M (positive but lower than Q1's $4.1M)
- CapEx: $4.7M (Singapore datacenter completion: $3.1M + Sydney office: $1.6M)
- Free cash flow: -$1.9M (first negative FCF quarter in 3 quarters)
- Credit facility: $12M drawn of $40M available; all covenants met (minimum cash covenant: $50M — current headroom: $33.7M)

Rachel noted that the negative FCF was expected due to one-time APAC infrastructure costs and should normalize in Q3.

## 4. Legal and Compliance Report — Thomas Wright

### Patent Dispute Update — Pinnacle Systems

- Meridian filed its response to Pinnacle's complaint on April 30, asserting invalidity based on prior art and non-infringement based on architectural differences
- Discovery phase has begun; Pinnacle has requested extensive documentation of Atlas 2.0 and 3.0 architecture (2019-2024)
- **Key development:** Pinnacle's lead litigation attorney (Karen Whitfield of Kirkland & Ellis — no relation to Whitfield & Associates the customer) filed a motion to expedite the Markman hearing from August to July; motion was denied by Judge Margaret Santos of the Northern District of California
- Legal spend to date: $1.3M ($410K Q1 + $890K Q2)
- Updated cost estimate: $3-5M total if case goes to trial (up from $2-4M due to broader discovery scope)
- Thomas's assessment: Meridian's prior art defense remains strong. Atlas 2.0 (released September 2019) predates Pinnacle's patent application (filed January 2021) by 16 months.

### Regulatory Compliance

- CPRA compliance audit completed June 10 by external auditor (EY)
- **Result:** Compliant with two recommendations: (1) update cookie consent mechanism to include granular opt-out for analytics cookies, (2) improve data subject request response tracking dashboard
- Both recommendations accepted; engineering estimates 3 weeks to implement
- GDPR data subject access requests: 52 in Q2 (up from 47 in Q1) — all completed within statutory timeline
- No regulatory actions, fines, or formal inquiries received in Q2

### Whitfield & Associates Contract

- Thomas reviewed the proposed contract amendment (15% discount for 2-year commitment)
- Amendment includes: modified SLA with 99.95% uptime guarantee (up from 99.9%), dedicated support channel, and priority access to future releases
- Thomas flagged that the precedent of offering discounts for retention could create expectations with other enterprise customers if it becomes known
- Board discussed in context of CEO's retention plan (see above)

### Intellectual Property

- 3 new patent applications filed in Q2:
  1. "Adaptive Query Optimization for Multi-Tenant Analytics Platforms" (Atlas 4.0 related)
  2. "Machine Learning-Based Anomaly Detection in Time-Series Business Data" (Beacon 2.0 related)
  3. "Cross-Platform Data Mesh Federation Protocol" (research project)
- Total patent portfolio: 31 issued patents, 12 pending applications
- Trademark registration for "Beacon" in analytics category completed in EU and US

## 5. SMB Self-Serve Strategy — Maria Santos

Maria presented the formal proposal for SMB migration to self-serve, as requested at the Q1 meeting.

### Proposal

- Transition 847 SMB customers to a self-serve platform by Q4 2026
- Reduce dedicated SMB sales team from 22 to 6 (account management only)
- Invest $1.8M in self-serve onboarding portal, automated billing, and in-product support
- Projected savings: $3.4M annually in sales and support costs
- Projected revenue impact: -$1.2M in Year 1 (some customers won't transition), +$0.5M in Year 2 (lower friction acquisition)
- Net benefit: $2.7M by end of Year 2

### Discussion

**Linda Nakamura** asked about the 16 SMB sales reps being displaced. Maria responded that 8 would be offered roles in the APAC expansion or mid-market team; the remaining 8 would receive severance packages (estimated total: $620K).

**James Harrington** supported the plan but asked for monthly metrics during the transition.

**Vote on SMB Self-Serve Migration:**

- Unanimous approval (4-0, management abstaining)

## 6. Compensation Committee Update — Linda Nakamura

### VP of Product Compensation

- Board approved compensation package for incoming VP of Product: base salary up to $425K, target bonus 50%, equity grant of 150,000 options vesting over 4 years with 1-year cliff
- This represents 75th percentile per Radford benchmark to attract top talent after Janet Liu's departure

### Equity Plan

- Shareholder vote on 2M additional share pool scheduled for October annual meeting
- Current burn rate: ~380K shares per quarter; existing pool exhausted by Q1 2027 without expansion
- Board approved management's proxy statement recommendation

### Employee Retention

- Linda flagged the employee satisfaction survey results (see Employee Survey document) as concerning
- Engineering satisfaction dropped to 3.4 (from 4.1 a year ago), with "burnout" and "lack of clear product direction" as top themes
- Board requested management present a retention action plan at the October meeting, specifically addressing engineering morale

## 7. Board Committee Assignments

Patricia Chen announced the following committee rotations effective Q3:

- **Audit Committee:** Robert Okafor (Chair), Linda Nakamura
- **Compensation Committee:** Linda Nakamura (Chair), James Harrington
- **Governance & Nominating Committee:** Patricia Chen (Chair), Robert Okafor
- **Technology Advisory Committee:** Linda Nakamura (Chair), Anil Gupta (management liaison)

## 8. Executive Session

Board entered executive session at 12:01 PM. Topics recorded separately per board policy.

## 9. Adjournment

Meeting adjourned at 12:38 PM.

Next scheduled board meeting: **October 8, 2026**

---

**Approved:**
Patricia Chen, Board Chair
Date: October 8, 2026
