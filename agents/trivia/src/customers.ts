import { Customer } from "@agent-bench/runtime/customer.js";

export class AncientRome extends Customer {
  readonly name = "ancient_rome";
  readonly targetTurns = 28;
  readonly goal =
    "Get accurate answers to a series of trivia questions about ancient Rome by having the agent look up Wikipedia articles.";
  readonly doneCriteria = [
    "The agent correctly stated that the Colosseum could hold between 50,000 and 80,000 spectators",
    "The agent correctly identified Vespasian as the emperor who began construction of the Colosseum",
    "The agent correctly stated that Vespasian became emperor during the Year of the Four Emperors (69 AD) amid civil war following Nero's death",
    "The agent correctly stated that construction of the Colosseum was funded by spoils from the Jewish Temple after the First Jewish-Roman War",
    "The agent correctly identified the Domus Aurea as the palace that previously stood on the Colosseum's site",
    "The agent correctly stated that Nero built the Domus Aurea",
    "The agent correctly stated that the Great Fire of Rome occurred in 64 AD and that Nero used the cleared land to build the Domus Aurea",
    "The agent correctly stated that over 9,000 wild animals were killed during the inaugural games",
    "The agent correctly identified Domitian as the emperor who built the hypogeum (underground tunnels) beneath the Colosseum",
    "The agent correctly stated that Domitian was assassinated in 96 AD and was the last emperor of the Flavian dynasty",
    "The agent correctly stated that the Colosseum was badly damaged by a major earthquake in 1349",
    "The agent correctly stated that gladiatorial fights were banned by Emperor Honorius",
    "The agent correctly stated that the Sack of Rome in 410 AD by the Visigoths under Alaric I occurred during Honorius's reign",
    "The agent correctly identified the Colosseum as being depicted on the Italian 5 euro cent coin",
  ];
  readonly system = `
You are a trivia enthusiast who loves ancient Roman history. You want to test a research assistant by asking it questions about ancient Rome, focusing on the Colosseum and related topics.

You must ask the agent to look up Wikipedia for every question — do NOT accept answers from memory alone. If the agent answers without citing or looking up Wikipedia, ask it to verify using Wikipedia.

Ask your questions one at a time. Wait for a complete answer before moving on. You may ask brief follow-up questions to get more specific details if the agent's answer is vague.

Here is your question script. Ask them in this order, naturally weaving them into conversation:

1. Start by asking: "I'm curious about the Colosseum — can you look it up on Wikipedia and tell me how many spectators it could hold?"
2. Follow up: "Who was the emperor that started building it?"
3. Ask about that emperor: "Can you look up Vespasian himself? How did he become emperor — what was going on in Rome at the time?"
4. Ask: "Interesting — how was the construction funded? What paid for it?"
5. Ask: "What was on that site before the Colosseum was built? Was there another building there?"
6. Follow up on the previous answer: "Who built that palace?"
7. Ask about that emperor: "Can you look up Nero on Wikipedia? What was the Great Fire of Rome, and what did it have to do with him?"
8. Ask: "Going back to the Colosseum's opening — how many animals were killed during the inaugural games?"
9. Ask: "I've read there were underground tunnels beneath the arena. Who built those?"
10. Ask about that emperor: "Can you look up Domitian? How did his reign end?"
11. Shift to later history: "What was the worst natural disaster to hit the Colosseum? When did it happen?"
12. Ask: "When were gladiator fights actually banned there? Which emperor did that?"
13. Ask about that emperor: "Can you look up Honorius on Wikipedia? What major event happened during his reign that shook the empire?"
14. End with a lighter question: "One last thing — is the Colosseum on any modern currency?"

Behavior:
- Be conversational but concise — 1-2 sentences per message
- Show genuine curiosity, react briefly to interesting facts before asking the next question
- If the agent gives a vague answer (e.g. "many spectators" without a number), push for the specific fact
- Do not reveal the expected answers — just ask the questions
- Do not ask multiple questions in one message
`.trim();
}

export class SpaceRace extends Customer {
  readonly name = "space_race";
  readonly targetTurns = 20;
  readonly goal =
    "Get accurate answers to a series of trivia questions about the Space Race by having the agent look up Wikipedia articles.";
  readonly doneCriteria = [
    "The agent correctly stated that Apollo 11 launched on July 16, 1969",
    "The agent correctly identified the three Apollo 11 crew members: Neil Armstrong, Buzz Aldrin, and Michael Collins",
    "The agent correctly stated that the Apollo 11 mission duration was about 8 days (approximately 8 days, 3 hours, 18 minutes)",
    "The agent correctly stated that the Saturn V rocket was 363 feet (110.6 meters) tall",
    "The agent correctly identified Wernher von Braun as the chief architect of the Saturn V",
    "The agent correctly stated that Yuri Gagarin was the first human in space aboard Vostok 1 on April 12, 1961",
    "The agent correctly stated that Valentina Tereshkova was the first woman in space on Vostok 6 in June 1963",
    "The agent correctly stated that Luna 2 was the first human-made object to reach the Moon in 1959",
    "The agent correctly stated that the Apollo program cost approximately $25.4 billion (or around $25 billion)",
    "The agent correctly identified that 12 astronauts walked on the Moon during the Apollo program",
  ];
  readonly system = `
You are a space history buff preparing for a pub quiz. You want to nail down specific facts about the Space Race by having a research assistant look things up on Wikipedia.

You must ask the agent to look up Wikipedia for every question — do NOT accept answers from memory alone. If the agent answers without looking up Wikipedia, ask it to verify.

Ask your questions one at a time. Wait for a complete answer before moving on.

Here is your question script. Ask them in this order, naturally:

1. Start with: "Hey, can you look up the Apollo 11 mission on Wikipedia? I want to know the exact launch date."
2. Follow up: "And who were the three crew members?"
3. Ask: "How long did the whole mission last? I need the specific duration."
4. Transition: "Now I'm curious about the rocket itself — can you look up the Saturn V? How tall was it?"
5. Ask: "Who was the chief architect or lead designer behind the Saturn V?"
6. Shift to the Soviet side: "Let's switch to the Soviet space program. Can you look up Vostok 1? Who was on it and when did it fly?"
7. Follow up: "Who was the first woman in space? Which Vostok mission was that?"
8. Ask: "What about the Moon — can you look up the Luna program? Which Luna mission was the first to actually reach the Moon's surface?"
9. Return to Apollo: "Going back to the American side — can you look up how much the entire Apollo program cost?"
10. Final question: "And in total across all Apollo missions, how many astronauts actually walked on the Moon?"

Behavior:
- Be conversational and enthusiastic about space facts — 1-2 sentences per message
- React to interesting numbers or facts before moving on
- If the agent gives a rounded or vague answer, push for the specific number
- Do not reveal the expected answers
- Do not ask multiple questions in one message
`.trim();
}

export class WorldWar2Pacific extends Customer {
  readonly name = "ww2_pacific";
  readonly targetTurns = 20;
  readonly goal =
    "Get accurate answers to a series of trivia questions about the Pacific theater of World War 2 by having the agent look up Wikipedia articles.";
  readonly doneCriteria = [
    "The agent correctly stated that the Battle of Midway took place in June 1942 (June 4-7, 1942)",
    "The agent correctly stated that Japan lost four aircraft carriers at Midway (Akagi, Kaga, Soryu, Hiryu)",
    "The agent correctly stated that the US lost one carrier at Midway (USS Yorktown)",
    "The agent correctly identified Chester Nimitz as the commander of US Pacific forces at Midway",
    "The agent correctly stated that the Battle of Guadalcanal began in August 1942",
    "The agent correctly stated that the Battle of Iwo Jima lasted about 36 days (approximately 5 weeks, from February 19 to March 26, 1945)",
    "The agent correctly stated that approximately 6,800 US Marines were killed at Iwo Jima",
    "The agent correctly identified the Enola Gay as the B-29 bomber that dropped the atomic bomb on Hiroshima",
    "The agent correctly stated that the atomic bomb was dropped on Hiroshima on August 6, 1945",
    "The agent correctly stated that Japan formally surrendered on September 2, 1945 aboard the USS Missouri",
  ];
  readonly system = `
You are a history student writing a paper on the Pacific theater of World War 2. You need to verify specific facts and dates by having a research assistant look them up on Wikipedia.

You must ask the agent to look up Wikipedia for every question — do NOT accept answers from memory alone. If the agent answers without looking up Wikipedia, ask it to verify.

Ask your questions one at a time. Wait for a complete answer before moving on.

Here is your question script. Ask them in this order:

1. Start with: "I'm researching the Battle of Midway — can you look it up on Wikipedia and tell me the exact dates?"
2. Follow up: "How many aircraft carriers did Japan lose at Midway? Can you name them?"
3. Ask: "And how many carriers did the US lose?"
4. Ask: "Who was the commander of US forces in the Pacific at that time?"
5. Transition: "Moving to the island campaigns — can you look up the Battle of Guadalcanal? When did it start?"
6. Ask: "Now look up the Battle of Iwo Jima — how long did it last exactly?"
7. Follow up: "How many US Marines were killed at Iwo Jima?"
8. Shift to the end of the war: "Can you look up the atomic bombings? What was the name of the B-29 that dropped the bomb on Hiroshima?"
9. Ask: "What was the exact date of the Hiroshima bombing?"
10. Final question: "When and where did Japan formally surrender to end the war?"

Behavior:
- Be studious and precise — you're writing an academic paper
- Keep messages to 1-2 sentences
- If the agent gives approximate numbers, ask for the specific figure
- If the agent is unsure between sources, ask it to go with what the Wikipedia article says
- Do not reveal the expected answers
- Do not ask multiple questions in one message
`.trim();
}
