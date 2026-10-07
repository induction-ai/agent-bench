import { Customer } from "@agent-bench/runtime/customer.js";

export class BoardMember extends Customer {
  readonly name = "board_member";
  readonly targetTurns = 17;
  readonly goal =
    "Prepare for the upcoming board meeting by reviewing documents and getting specific answers about financial performance, risk, compliance, and governance matters.";
  readonly doneCriteria = [
    "The agent stated that Q2 2026 total revenue was $52.1M, representing 10.1% QoQ growth",
    "The agent stated that net revenue retention declined from 112% in Q1 to 108% in Q2",
    "The agent stated that Whitfield & Associates ($4.2M ARR) is at risk of churning, with contract renewal on September 30, 2026",
    "The agent stated that the SOC 2 Type II audit had one finding: data retention policies were not consistently enforced across three legacy staging environments that retained customer data beyond the 90-day contractual limit",
    "The agent stated that the Pinnacle patent dispute involves US Patent No. 11,847,293 for 'distributed real-time data stream processing', filed by Pinnacle in January 2021, and that Meridian's prior art defense is based on Atlas 2.0 released September 2019",
    "The agent stated that total operating expenses grew 14.1% QoQ (from $41.2M to $47.0M) while revenue grew 10.1%, and that Q2 OpEx exceeded budget by $2.4M",
    "The agent stated that D&O insurance was renewed at $2.4M annual premium with $50M aggregate coverage and $1M retention, carried by Hartford Financial Services",
    "The agent stated that the board voted 3-1 to approve the Atlas 4.0 delay, with James Harrington dissenting and requesting a post-mortem at the October meeting",
    "The agent stated that the APAC expansion budget was approved at $4.8M (reduced from the strategic plan's $5.2M) by deferring the Tokyo office lease to Q3",
    "The agent stated that FedRAMP authorization has slipped from Q4 2026 to Q1 2027, putting $7.95M in defense deal pipeline at risk (Archer Defense, Falcon Aerospace, Trident Naval)",
    "The agent stated that the product team headcount is 32 (down from 38), 6 below budget, with the VP of Product position vacant since April 18 and an active search via Spencer Stuart",
    "The agent stated that engineering engagement score is 3.4 with work-life balance at 2.6 (lowest score in any department), and that 'burnout from Atlas 4.0 crunch' was cited by 67% of engineering respondents",
    "The agent stated that cash position is $83.7M, free cash flow was -$1.9M (first negative in 3 quarters), and that $12M is drawn on a $40M credit facility with a $50M minimum cash covenant",
    "The agent stated that the SMB self-serve migration was approved unanimously, projecting $3.4M in annual savings, with 8 layoffs and $620K in severance costs",
    "The agent stated that the Rule of 40 score declined from 36 in Q1 to 34 in Q2, below the 40 threshold, and that the CFO flagged operating losses as possible by Q4 if OpEx growth isn't contained",
  ];
  readonly initialMessage =
    "I need to review the Q2 board materials. Can you start by listing what documents are available?";
  readonly system = `
You are Patricia Chen, Board Chair of Meridian Technologies and Managing Partner at Crestfall Ventures. You're preparing for the October 2026 board meeting and need to thoroughly review the Q2 materials.

You are a rigorous, detail-oriented board member focused on governance, financial oversight, risk management, and compliance. You don't accept vague answers — you want specific numbers, dates, and names from the documents.

You have exactly 16 remaining questions to ask (you already asked the first one about listing documents). Ask them one at a time, in this exact order. Use the wording below verbatim or near-verbatim:

1. "Let's start with the financial picture. What was our Q2 revenue and how did it compare to Q1?"
2. "I'm concerned about the retention trends. What happened to net revenue retention, and what's driving the decline?"
3. "Give me the details on the Whitfield & Associates situation. What's the ARR at risk and when is the renewal?"
4. "Now pull up the legal compliance report. What were the SOC 2 audit results? I want the specific finding, not just 'clean opinion.'"
5. "What's the current status of the Pinnacle patent dispute? I need the patent number, what it covers, and our defense strategy."
6. "I'm worried about cost discipline. How did operating expenses track versus revenue growth and versus budget?"
7. "What's the status of our D&O insurance? I need the premium, coverage limits, retention, and carrier."
8. "Looking at the board minutes — how did the board vote on the Atlas 4.0 delay? Were there any dissenting votes?"
9. "The strategic plan called for $5.2M for APAC expansion. What was actually approved and what was changed?"
10. "What's the status of FedRAMP authorization? Are there deals blocked by the timeline?"
11. "Pull up the headcount budget. What's the situation in the product team — how does actual headcount compare to budget?"
12. "Now look at the employee survey results. What are the engineering department scores? I want the specific engagement and work-life balance numbers."
13. "What's our cash position and free cash flow? And what's our credit facility situation — how much is drawn and what are the covenants?"
14. "The board voted on the SMB self-serve migration. What are the projected savings and what's the people impact — how many layoffs and what's the severance cost?"
15. "What's our Rule of 40 score? And what did the CFO say about the profitability trajectory if expenses aren't contained?"
16. "Anything else in the risk register I should flag for the October meeting?"

Rules:
- Ask exactly these 16 questions in this order — no more, no fewer
- Keep messages to 1-2 sentences — just the question, no preamble
- If the agent gives a vague answer without specific numbers, say "I need the specific numbers from the document" and wait — this does NOT count as a new question
- Do not reveal the expected answers
- Do not ask multiple questions in one message
- Do not improvise extra follow-up questions beyond the script
- When you have asked all 16 questions and received answers, call the done tool immediately
`.trim();
}

export class CEO extends Customer {
  readonly name = "ceo";
  readonly targetTurns = 17;
  readonly goal =
    "Review board materials to prepare talking points about product strategy, growth, competitive positioning, and the sales pipeline.";
  readonly doneCriteria = [
    "The agent stated that Atlas 4.0 launch was delayed 6 weeks from May 15 to June 26 due to three factors: API gateway rewrite complexity, VP of Product departure (Janet Liu), and a security vulnerability (CVE-2026-4471)",
    "The agent stated that GlobalTech Industries is an $8.5M potential ARR deal currently in security review stage with 75% probability, and that the key differentiator is Meridian's 180+ connectors vs Pinnacle's 43",
    "The agent stated that Beacon Analytics generated $3.2M in Q2 revenue (up 78% from Q1's $1.8M) with 35 paying customers, and that fraud detection is the top use case at 28% of Beacon revenue",
    "The agent stated that Pinnacle Systems raised $200M Series D at $2.8B valuation led by Sequoia Capital, and plans to double enterprise AEs from 45 to 90",
    "The agent stated that the APAC expansion hired Yuki Tanaka as VP of APAC Sales, targeting Australia and Japan first, with 3 qualified pipeline opportunities totaling $7.1M",
    "The agent stated that there are 47 deals in the sales pipeline totaling $34.7M potential ARR, with the top 3 being GlobalTech ($8.5M), Federated Health ($5.1M), and Archer Defense ($4.3M)",
    "The agent stated that employee engagement dropped from 4.2 to 3.8 overall, with engineering at 3.4 and work-life balance at 2.6, citing 'burnout from Atlas 4.0 crunch' as the top theme",
    "The agent stated that Beacon 2.0 ('Aurora') targets Q4 2026 with ML-powered anomaly detection led by Dr. Sarah Kim, and that the research team has the highest engagement score at 4.4",
    "The agent stated that Meridian's head-to-head win rate against Pinnacle is 50% (7 wins out of 14 competitive deals), with integration depth cited in 6 of 7 wins",
    "The agent stated that the product team is in crisis with a -18 eNPS, the VP of Product position vacant since April 18, and 44% of remaining product staff considering leaving",
    "The agent stated that Kevin Park (Staff Engineer) departed to Pinnacle Systems on June 12 with a 35% comp increase, and that he was a primary architect of Atlas 4.0's streaming engine",
    "The agent stated that 5 enterprise customers are in the Atlas 4.0 beta, and that Whitfield & Associates' feedback was 'cautiously positive' while DataVault Corp said 'streaming is game-changing'",
    "The agent stated that the enterprise segment hit 52.4% of total revenue for the first time, growing at an 11.0% QoQ rate",
    "The agent stated that Q2 operating expenses exceeded budget by $2.4M, with $1.5M from Atlas 4.0 overruns, and that gross margin declined from 74.2% to 73.8%",
    "The agent stated that the company direction score in the employee survey dropped from 4.1 to 3.7, and engineering's company direction score was 3.3 (down 0.9 from Q4 2025)",
  ];
  readonly initialMessage =
    "Let me see what board documents we have. List everything available.";
  readonly system = `
You are David Park, CEO of Meridian Technologies. You're preparing for the October board meeting and want to build a compelling narrative about the company's trajectory. You need to review the documents thoroughly to have crisp answers for the board.

You have exactly 16 remaining questions to ask (you already asked the first one about listing documents). Ask them one at a time, in this exact order. Use the wording below verbatim or near-verbatim:

1. "Pull up the product roadmap. I need the full story on the Atlas 4.0 delay — exactly what caused it and the new timeline."
2. "What's the latest on the GlobalTech Industries deal? I need the ARR, stage, probability, and what's differentiating us."
3. "How did Beacon Analytics perform in Q2? I want revenue, growth rate, customer count, and what use cases are driving it."
4. "Read the competitor analysis. What do we know about Pinnacle's Series D and their plans?"
5. "What's our actual win/loss record against Pinnacle? I need the numbers from competitive deals, and what's driving wins versus losses."
6. "What's the full sales pipeline look like? Total deals, total potential ARR, and the top 3 opportunities."
7. "Give me the employee survey headline numbers — overall engagement and the worst department scores."
8. "What specifically are engineers saying? And what's the situation in the product team — eNPS, attrition risk?"
9. "Pull up the APAC update from the board minutes. How is Yuki Tanaka's team doing? Pipeline numbers?"
10. "What's the Beacon 2.0 roadmap and timeline? Who's leading it and how's that team's morale?"
11. "I heard Kevin Park left for Pinnacle. Pull up the details — what role was he in and what are the terms of his departure?"
12. "What are the enterprise customers in the Atlas 4.0 beta saying? Give me the specific feedback from each."
13. "How big is the enterprise segment now as a share of total revenue? And what's the QoQ growth rate?"
14. "What's the cost picture look like? How much did we exceed budget by, and what happened to gross margins?"
15. "What's the company direction score from the survey? Break it down by department if you can."
16. "That covers what I need. Thanks."

Rules:
- Ask exactly these 16 questions in this order — no more, no fewer
- Keep messages to 1-2 sentences — just the question, no preamble
- If the agent gives a vague answer without specific numbers, say "I need the specific numbers from the document" and wait — this does NOT count as a new question
- Do not reveal the expected answers
- Do not ask multiple questions in one message
- Do not improvise extra follow-up questions beyond the script
- When you have asked all 16 questions and received answers, call the done tool immediately
`.trim();
}
