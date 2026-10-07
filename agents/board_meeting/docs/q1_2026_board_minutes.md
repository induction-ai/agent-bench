# Meridian Technologies — Board of Directors Meeting Minutes

**Date:** April 2, 2026
**Location:** Meridian HQ, 1200 Innovation Drive, San Mateo, CA (Hybrid — Zoom link provided)
**Called to Order:** 9:03 AM PT by Board Chair Patricia Chen

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
- **Janet Liu** — VP of Product (via Zoom)

### Minutes Recorded By

Sophie Andersen, Corporate Secretary

---

## 1. Call to Order and Approval of Previous Minutes

Patricia Chen called the meeting to order at 9:03 AM. Minutes from the January 15, 2026 meeting were reviewed. Robert Okafor noted a minor correction to the recorded vote count on the Series C warrant extension — the vote was 4-1 (Harrington dissenting), not unanimous as recorded. Corrected minutes were approved unanimously.

## 2. CEO Report — David Park

David Park presented the Q1 2026 operating update. Key highlights:

### Financial Performance

- **Total Revenue:** $47.3M (up 6.8% from Q4 2025's $44.3M)
- **ARR:** $196M as of March 31, 2026 (up from $182M at end of Q4 2025)
- **Gross Margin:** 74.2% (down from 75.1% in Q4 due to additional infrastructure costs for enterprise deployments)
- **Net Income:** $2.8M (first profitable quarter excluding one-time items)
- **Cash Position:** $89.4M (includes $12M drawn from credit facility)

David emphasized that Q1 marked the first quarter of operating profitability on a non-GAAP basis, a milestone the board had targeted for mid-2026. He attributed this to disciplined hiring in Q4 2025 and strong enterprise deal flow.

### Customer Metrics

- **Total Customers:** 1,247 (up from 1,198 in Q4)
- **Enterprise Customers (>$500K ARR):** 38 (up from 34)
- **Net Revenue Retention Rate:** 112% (down from 115% in Q3 2025)
- **Gross Churn Rate:** 4.8% annualized (up from 3.9% in Q4)

David noted the retention rate decline was primarily driven by three mid-market customers who reduced seat counts after workforce reductions. He flagged Whitfield & Associates ($4.2M ARR) as a risk account — they had expressed dissatisfaction with the Atlas 3.x platform's reporting capabilities and were evaluating Pinnacle Systems as an alternative. A dedicated customer success team had been assigned.

**James Harrington** asked for more detail on the Whitfield situation. David explained that Whitfield's primary complaints centered on (a) lack of real-time dashboard refresh in Atlas 3.x, (b) limited API throughput for their data volume, and (c) delayed response times from customer success. He stated that all three issues would be addressed in Atlas 4.0, targeted for May release.

**Patricia Chen** asked whether the Atlas 4.0 timeline was firm. Anil Gupta responded that engineering was on track but acknowledged "moderate schedule risk" due to the API gateway rewrite being more complex than initially estimated. He estimated a 60% probability of hitting the May 15 target.

### Product Update

- Atlas 3.x: Three minor releases shipped in Q1, addressing 47 customer-reported bugs
- Atlas 4.0: In final development phase; major features include real-time streaming, redesigned API gateway, and enterprise SSO improvements
- Beacon Analytics: Strong early traction — $1.8M quarterly revenue, 23 paying customers

### Strategic Initiatives

- **APAC Expansion:** Hired VP of APAC Sales, Yuki Tanaka (started March 3). Initial focus on Australia and Japan. Office lease signed in Sydney for August occupancy.
- **Beacon Analytics Growth:** Investing in ML capabilities for anomaly detection (Beacon 2.0, targeted Q4 2026)
- **Enterprise Platform:** Atlas 4.0 positions the platform for $1M+ ARR deals with real-time capabilities

## 3. CFO Report — Rachel Morrison

Rachel presented the detailed financial review.

### Revenue Analysis

- Enterprise segment grew 7.9% QoQ ($22.8M to $24.6M), driven by 4 new logos and expansion in 8 existing accounts
- Mid-Market segment grew 4.3% ($13.9M to $14.5M), in line with plan
- SMB segment declined 5.9% ($6.8M to $6.4M) — sixth consecutive quarter of decline; Rachel recommended the board consider discontinuing active SMB sales and shifting to self-serve
- Beacon Analytics grew 125% ($0.8M to $1.8M) — ahead of the $1.2M internal forecast

### Operating Expenses

- Total OpEx: $41.2M (up 8.4% from $38.0M in Q4)
- Engineering: $16.8M — largest spend driver; Atlas 4.0 development and infrastructure scaling
- Sales & Marketing: $12.4M — APAC buildout costs hitting earlier than budgeted
- G&A: $5.2M — legal costs up due to Pinnacle patent dispute (see Legal section)
- Customer Success: $4.9M — added 11 implementation engineers for enterprise backlog
- Research: $1.9M — Beacon 2.0 ML research team hired ahead of schedule

### Cash Flow

- Operating cash flow: $4.1M (positive for second consecutive quarter)
- CapEx: $3.2M (new datacenter buildout in Singapore for APAC)
- Free cash flow: $0.9M
- Credit facility: $12M drawn of $40M available; covenants met

**Robert Okafor** expressed concern about OpEx growth rate (8.4%) outpacing revenue growth (6.8%) and asked if this trend would continue. Rachel acknowledged the gap and stated it was intentional for Q1 due to frontloaded APAC and engineering investments. She projected OpEx growth to moderate to 5-6% in Q2 while revenue accelerated to 8-10% with enterprise deal closings.

**Linda Nakamura** asked about the SMB decline. Rachel explained the economics: average SMB deal was $52K ARR with a 14-month payback period, versus enterprise at $680K ARR with 9-month payback. She recommended the board approve a strategy shift to self-serve for SMB by Q3. The board asked management to present a formal proposal at the next meeting.

## 4. Legal and Compliance Report — Thomas Wright

Thomas Wright presented the legal update.

### Patent Dispute — Pinnacle Systems

- Pinnacle Systems filed a patent infringement claim on February 12, 2026, alleging Meridian's Atlas real-time analytics processing infringes on US Patent No. 11,847,293 ("Method and System for Distributed Real-Time Data Stream Processing")
- Outside counsel (Morrison & Foerster) has been retained; initial assessment is that Meridian has strong prior art defense based on the Atlas 2.0 architecture predating the patent filing
- Estimated legal costs: $2-4M over 12-18 months if case goes to trial
- Settlement discussions have not been initiated; Thomas recommended waiting for the Markman hearing (scheduled August 2026) before engaging
- **Risk assessment:** Medium. The patent is broadly written but Pinnacle's enforcement history is weak (0-3 in prior patent cases)

**James Harrington** asked whether this could impact the Atlas 4.0 release. Thomas said no — the patent claim targets the real-time processing method, not the product itself, and Atlas 4.0's architecture uses a fundamentally different approach (event-sourced streaming vs. the batch-micro-batch method described in the patent).

### SOC 2 Type II Audit

- Completed March 15, 2026 by Deloitte
- **Result:** Clean opinion with one observation
- **Finding:** Data retention policies for customer analytics data were not consistently enforced across all production environments. Specifically, three legacy staging environments retained customer data beyond the 90-day retention window specified in customer contracts.
- **Remediation:** Engineering deployed automated data lifecycle management across all environments by March 28. Thomas confirmed full remediation before the report was finalized.
- The finding was classified as "low severity" and does not impact the overall SOC 2 Type II certification

### D&O Insurance

- Renewed effective March 1, 2026
- Annual premium: $2.4M (up 12% from prior year due to increased company valuation)
- Aggregate coverage: $50M with $1M retention
- Side A DIC coverage: $15M
- Carrier: Hartford Financial Services Group
- Policy was reviewed by outside counsel and deemed adequate for current risk profile

### Other Legal Matters

- Employment dispute with former sales director (settled for $185K, NDA in place)
- GDPR data subject access request volume: 47 in Q1 (up from 31 in Q4) — all completed within statutory timeline
- California Privacy Rights Act (CPRA) compliance audit scheduled for Q2

## 5. Strategic Discussion — APAC Expansion

Maria Santos presented the APAC expansion plan for board approval.

### Proposal

- **Phase 1 (Q2-Q3 2026):** Australia and Japan
  - Sydney office: 15-person team (sales, pre-sales engineering, customer success)
  - Tokyo office: 8-person team (sales, partnerships)
  - Total Phase 1 budget: $5.2M
- **Phase 2 (Q1 2027):** Singapore and South Korea (contingent on Phase 1 results)
- **Revenue Target:** $4M ARR by end of 2026, $15M by end of 2027

### Discussion

**James Harrington** questioned whether the $5.2M investment was justified given the uncertain macro environment in APAC. He pointed to recent currency volatility in the yen and suggested starting with Australia only.

**Robert Okafor** supported the full plan, noting that several existing enterprise customers had APAC operations and had requested local support.

**Patricia Chen** proposed a compromise: approve $4.8M (reduced from $5.2M by deferring the Tokyo office lease to Q3) with a Q3 checkpoint before committing to the full Japan buildout.

**Vote on APAC Expansion (Modified — $4.8M budget):**

- Patricia Chen: Aye
- James Harrington: Aye (noted preference for Australia-only but accepted compromise)
- Linda Nakamura: Aye
- Robert Okafor: Aye
- David Park: Aye (non-binding as management)
- **Result: Approved unanimously (4-0, management abstaining)**

## 6. Compensation Committee Update — Linda Nakamura

Linda provided a brief update from the compensation committee:

- Executive compensation benchmarking study completed by Radford; Meridian's C-suite compensation is at 55th percentile vs. peers
- Recommended 2026 equity refresh grants for VP+ level; deferred to June meeting for board approval
- 2025 bonus payouts: 92% of target across the organization (reflecting slight miss on ARR target)
- Stock option pool: 2.3M shares remaining of 5M share 2024 equity plan; committee recommends requesting shareholder approval for additional 2M shares at next annual meeting

## 7. Executive Session

The board entered executive session at 11:47 AM (management excused except David Park for first portion, then fully excused).

Topics discussed in executive session are recorded separately per board policy.

## 8. Adjournment

Meeting adjourned at 12:22 PM.

Next scheduled board meeting: **July 9, 2026**

---

**Approved:**
Patricia Chen, Board Chair
Date: July 9, 2026
