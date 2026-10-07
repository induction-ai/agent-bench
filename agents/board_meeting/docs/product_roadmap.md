# Meridian Technologies — Product Roadmap

**Prepared by:** Anil Gupta, CTO (Interim VP of Product)
**Last Updated:** July 1, 2026
**Classification:** Board Confidential

---

## Product Portfolio Overview

Meridian's product portfolio consists of two main products:

1. **Atlas Platform** — Enterprise analytics platform. Core product generating ~94% of revenue.
2. **Beacon Analytics** — Intelligent alerting and anomaly detection. Newer product (~6% of revenue, growing rapidly).

---

## Atlas Platform Roadmap

### Atlas 4.0 — "Redwood" (GA: June 26, 2026)

Atlas 4.0 is the most significant platform release in Meridian's history, representing 14 months of development by a team of 78 engineers.

**Key Features:**

1. **Real-Time Streaming Engine**
   - Event-sourced architecture replacing batch-micro-batch processing
   - Sub-second dashboard refresh for enterprise tier
   - Supports up to 2M events/second per tenant (10x improvement over Atlas 3.x)
   - WebSocket-based push notifications for threshold alerts
   - _Status: Complete. Security vulnerability (CVE-2026-4471) in WebSocket implementation patched May 22._

2. **Redesigned API Gateway**
   - Full rewrite of authentication and rate-limiting layers
   - OAuth 2.1 support with PKCE flow
   - Granular API key scoping (read, write, admin, per-dataset)
   - Rate limiting: 10,000 requests/minute for enterprise tier (up from 1,000)
   - New GraphQL endpoint alongside existing REST API
   - _Status: Complete. This component caused the 6-week delay — the auth middleware was incompatible with the streaming protocol and required a full rewrite._

3. **Enterprise SSO Improvements**
   - SAML 2.0 and OIDC support (previously SAML only)
   - Just-in-time user provisioning from identity provider
   - Multi-factor authentication enforcement at organization level
   - Session management: configurable timeout, concurrent session limits
   - _Status: Complete._

4. **Advanced Query Engine**
   - New columnar query execution engine (codename "Sequoia")
   - 50% reduction in p95 query latency (target: <200ms)
   - Support for cross-dataset joins (previously required data export/import)
   - Materialized views with incremental refresh
   - _Status: Complete. Performance benchmarks show 47% latency improvement — slightly below 50% target. Optimization ongoing._

5. **Data Mesh Federation**
   - Connect to remote data sources without data movement
   - Supported sources: Snowflake, BigQuery, Databricks, Redshift, Azure Synapse
   - Federated query optimization across sources
   - _Status: Beta. Snowflake and BigQuery connectors complete. Databricks connector in testing. Redshift and Azure Synapse targeted for 4.1._

**Atlas 4.0 Beta Program:**

- 5 enterprise customers in beta since June 15: DataVault Corp, NexGen Financial, Consolidated Logistics, TerraForm Industries, and Whitfield & Associates
- Beta feedback summary (as of July 1):
  - DataVault Corp: "Streaming is game-changing for our trading floor dashboards. API gateway migration was smooth."
  - NexGen Financial: "Query performance is noticeably faster. OIDC integration worked first try."
  - Consolidated Logistics: "Cross-dataset joins will save us 20 hours/week of manual data prep."
  - TerraForm Industries: "Federation with Snowflake is exactly what we needed. Some rough edges in the UI."
  - Whitfield & Associates: "Cautiously positive. Real-time refresh addresses our #1 complaint. Still evaluating API throughput under production load."

**Known Issues at GA:**

1. Federation with Databricks shows intermittent timeout errors under high concurrency (>50 simultaneous queries). Fix targeted for 4.0.1 patch (July 15).
2. Dashboard migration tool from 3.x to 4.0 fails for dashboards with >100 widgets. Manual migration required for ~12% of enterprise dashboards. Fix targeted for 4.0.2 (August 1).
3. GraphQL endpoint does not yet support subscription queries (streaming via GraphQL). REST WebSocket approach works. GraphQL subscriptions targeted for 4.1.

### Atlas 4.1 — "Sequoia" (Target: Q4 2026)

1. **Remaining Federation Connectors** — Redshift, Azure Synapse, Oracle Database
2. **GraphQL Subscriptions** — Real-time streaming via GraphQL
3. **Embedded Analytics SDK** — Allow customers to embed Atlas dashboards in their own products
4. **Air-Gapped Deployment** — Full offline installation package for federal/defense customers (required for Archer Defense and Falcon Aerospace deals)
5. **Japanese Language Support** — Full UI and documentation localization (required for APAC expansion)
6. **Advanced RBAC** — Row-level and column-level security policies

**Team:** 45 engineers, led by Staff Engineer Marcus Chen (promoted to fill gap after PM departures)

### Atlas 5.0 — "Summit" (Target: Q2 2027)

Early planning stage. Tentative themes:

1. **AI-Powered Analytics** — Natural language query interface powered by LLM integration
2. **Automated Insights** — Proactive detection and surfacing of trends and anomalies (converging with Beacon)
3. **Multi-Cloud Control Plane** — Unified management across AWS, Azure, and GCP deployments
4. **Real-Time Collaboration** — Multi-user dashboard editing with conflict resolution

---

## Beacon Analytics Roadmap

### Beacon 1.x — Current Release (GA: Q3 2025)

Current capabilities:

- Threshold-based alerting on any Atlas metric
- Scheduled anomaly reports (daily, weekly)
- Integration with PagerDuty, Slack, Microsoft Teams, email
- Custom alert rules with AND/OR logic
- Historical anomaly timeline view

**Current metrics:**

- 35 paying customers
- $3.2M quarterly revenue ($12.8M annualized)
- Top verticals: fintech (28%), operations (23%), customer analytics (20%)
- Average implementation time: 3 weeks

### Beacon 2.0 — "Aurora" (Target: Q4 2026)

The major upgrade to Beacon, introducing ML-powered anomaly detection. Led by Dr. Sarah Kim (Principal Research Scientist, hired from Google DeepMind in Q4 2025).

**Key Features:**

1. **ML Anomaly Detection Engine**
   - Proprietary ensemble model combining isolation forests, LSTM autoencoders, and transformer-based forecasting
   - Automatic baseline learning per metric (no manual threshold configuration needed)
   - Adaptive sensitivity based on time-of-day, day-of-week, and seasonal patterns
   - Multi-dimensional anomaly detection (correlates anomalies across related metrics)
   - _Status: Research phase complete. Core models trained and validated against 6 months of anonymized customer data. False positive rate: 3.2% (target: <5%). Engineering implementation started June 1._

2. **Root Cause Analysis**
   - When an anomaly is detected, automatically identifies the most likely contributing factors
   - Uses causal inference techniques to distinguish correlation from causation
   - Generates natural language explanations: "Revenue dropped 12% because order volume from the APAC region declined, which correlates with the website outage on the Singapore CDN node"
   - _Status: Prototype. Early testing with 2 design partners. Natural language generation uses fine-tuned Llama model._

3. **Predictive Alerts**
   - Forecast metrics 24-72 hours ahead and alert before thresholds are breached
   - Confidence intervals on predictions
   - "What-if" scenario modeling: "What would revenue look like if conversion rate dropped 5%?"
   - _Status: Research. Forecasting models achieving 87% accuracy at 24-hour horizon, 71% at 72-hour. Needs improvement before shipping._

4. **Industry-Specific Models**
   - Pre-trained models for common patterns in healthcare, fintech, e-commerce, and manufacturing
   - Reduces time-to-value from 3 weeks to 3 days for standard use cases
   - _Status: Healthcare and fintech models in training. E-commerce and manufacturing targeted for post-launch._

**Beacon 2.0 Team:** 14 engineers + 4 ML researchers, led by Dr. Sarah Kim

**Estimated launch window:** November 2026 (internal target), with public messaging of "Q4 2026"

**Revenue projection:** Beacon 2.0 expected to increase average deal size by 40% and open new verticals (healthcare, cybersecurity). Target: $25M Beacon ARR by end of Q2 2027.

### Beacon 3.0 — "Constellation" (Target: Q2 2027)

Concept stage:

1. **Autonomous Response** — Beyond alerting, take automated corrective actions (e.g., scale infrastructure, trigger workflows)
2. **Cross-Customer Benchmarking** — Anonymous benchmarks comparing a customer's metrics to industry peers
3. **Compliance Anomaly Detection** — Specialized models for detecting regulatory compliance violations in real-time

---

## Product Team Status

### Leadership

- **VP of Product:** VACANT since April 18 (Janet Liu departed)
  - Search firm: Spencer Stuart
  - Candidates: 4 on shortlist, interviews beginning late July
  - Interim: Anil Gupta (CTO) serving as interim VP of Product
  - Impact: Product prioritization decisions are slower; roadmap reviews delayed by 2 weeks

### Headcount

- **Product Management:** 32 (down from 38 — VP + 2 Senior PMs departed, 3 junior PMs re-assigned to engineering)
  - This is the most significant headcount concern in the company. The product team is operating at 84% capacity.
- **Engineering (Atlas):** 234
- **Engineering (Beacon):** 62
- **Engineering (Platform/Infra):** 42
- **Research (Beacon 2.0):** 14
- **Total Product & Engineering:** 384

### Key Risks

1. **VP of Product vacancy** — Prolonged vacancy (now 11 weeks) is creating prioritization bottlenecks and affecting engineering morale. Engineers report unclear requirements for Atlas 4.1 features.
2. **Atlas 4.0 tech debt** — The security remediation and accelerated timeline introduced shortcuts that need to be addressed in 4.0.x patches. Estimated: 3 engineering-weeks of cleanup.
3. **Beacon 2.0 ML model drift** — Models need continuous retraining as customer data patterns evolve. Infrastructure for automated retraining pipeline not yet built.
4. **Japanese localization delay** — 4 weeks behind schedule. Original target: end of Q2. New target: end of Q3. Blocking Pacific Rim Logistics deal progression.
5. **FedRAMP timeline** — Application not yet submitted. Defense deals (Archer, Falcon, Trident) cannot proceed without authorization. Target slipped from Q4 2026 to Q1 2027. Combined deal ARR at risk: $7.95M.
