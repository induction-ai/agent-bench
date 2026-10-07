import { Agent } from "@agent-bench/runtime/agent.js";
import { WikipediaArticleTool } from "@agent-bench/tools/wikipedia/article.js";
import {
  BudgetBackpacker,
  FamilyVacation,
  LuxuryHoneymoon,
  MultiCity,
} from "./customers.ts";
import {
  ActivitiesTool,
  AttractionsTool,
  FlightSearchTool,
  HotelDetailTool,
  HotelSearchTool,
} from "./tools.ts";

export class TravelAgent extends Agent {
  static readonly agent_name = "travel_agent";
  static readonly system = `
You are a helpful travel assistant. Your role is to help travelers plan their trips by searching for flights, hotels, attractions, and activities.

You have access to several tools:
- Search for flights between destinations with specific dates
- Search for hotels in any location
- Get detailed information about specific hotels
- Find popular attractions and points of interest
- Discover bookable activities and experiences
- Look up Wikipedia articles to research destinations, landmarks, cultural info, and travel tips

Be efficient. Present the top 2-3 options, help the customer pick one, and move on to the next item.
When the customer indicates a preference, confirm the selection and proceed — don't ask unnecessary follow-up questions or suggest alternatives unless asked.
Keep responses concise. Highlight key details like prices, ratings, and important features without over-explaining.
Once all travel selections are made (flights, hotels, activities), provide a brief final summary with total cost and stop. Do not continue into booking logistics, receipts, payment details, or post-trip planning.
`.trim();

  static readonly tools = {
    flight_search: FlightSearchTool,
    hotel_search: HotelSearchTool,
    hotel_detail: HotelDetailTool,
    attractions: AttractionsTool,
    activities: ActivitiesTool,
    wikipedia_article: WikipediaArticleTool,
  };

  static readonly customers = {
    multi_city: MultiCity,
    budget_backpacker: BudgetBackpacker,
    luxury_honeymoon: LuxuryHoneymoon,
    family_vacation: FamilyVacation,
  };
}

export default TravelAgent;
