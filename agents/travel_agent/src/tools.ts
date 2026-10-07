import { ToolBase, ToolFromLLM } from "@agent-bench/runtime/tool.js";
import { z } from "zod";

// --- flight_search ---
const flightSearchSchema = z.object({
  origin: z.string().describe("Departure city or airport code"),
  destination: z.string().describe("Destination city or airport code"),
  departure_date: z.string().describe("Departure date (YYYY-MM-DD)"),
  return_date: z
    .string()
    .optional()
    .describe("Return date for round trip (YYYY-MM-DD), omit for one-way"),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe("Pagination offset, returns 10 results starting from offset"),
});

export class FlightSearchTool extends ToolBase<typeof flightSearchSchema> {
  readonly description =
    "Search for available flights between two locations on specific dates";
  readonly inputSchema = flightSearchSchema;

  execute({
    origin,
    destination,
    departure_date,
    return_date,
    offset,
  }: z.infer<typeof flightSearchSchema>) {
    const airlines = [
      "United Airlines",
      "Delta Air Lines",
      "American Airlines",
      "Southwest Airlines",
      "JetBlue Airways",
      "Alaska Airlines",
      "Spirit Airlines",
      "Frontier Airlines",
      "Hawaiian Airlines",
      "Air France",
      "British Airways",
      "Lufthansa",
      "Emirates",
      "Qatar Airways",
      "Singapore Airlines",
    ];

    const aircraftTypes = [
      "Boeing 737-800",
      "Airbus A320",
      "Boeing 787 Dreamliner",
      "Airbus A350",
      "Boeing 777-300ER",
      "Embraer E175",
      "Airbus A321neo",
    ];

    const departureTimes = [
      "06:15",
      "07:30",
      "08:45",
      "10:00",
      "11:30",
      "13:15",
      "14:45",
      "16:00",
      "17:30",
      "19:00",
      "20:30",
      "22:00",
    ];

    const routeHash =
      origin.charCodeAt(0) + destination.charCodeAt(0) + departure_date.length;

    const flights = Array(10)
      .fill(0)
      .map((_, i) => {
        const idx = offset + i;
        const seed = routeHash + idx;

        const airline = airlines[seed % airlines.length]!;
        const aircraft = aircraftTypes[(seed + 3) % aircraftTypes.length]!;
        const departureTime = departureTimes[seed % departureTimes.length]!;

        const baseDuration = 2 + ((seed * 7) % 12);
        const durationHours = Math.floor(baseDuration);
        const durationMinutes = (seed * 13) % 60;

        const [depHour, depMin] = departureTime.split(":").map(Number);
        const arrivalMinutes =
          depHour! * 60 + depMin! + durationHours * 60 + durationMinutes;
        const arrHour = Math.floor(arrivalMinutes / 60) % 24;
        const arrMin = arrivalMinutes % 60;
        const nextDay = arrivalMinutes >= 24 * 60;

        const stops = seed % 3;
        const basePrice = 150 + ((seed * 17) % 800);
        const price = Math.round(basePrice / 10) * 10;

        return {
          flight_id: `FL${String(seed).padStart(4, "0")}`,
          airline,
          flight_number: `${airline.substring(0, 2).toUpperCase()}${100 + (seed % 900)}`,
          origin,
          destination,
          departure_date,
          departure_time: departureTime,
          arrival_time: `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}${nextDay ? " +1" : ""}`,
          duration: `${durationHours}h ${durationMinutes}m`,
          stops:
            stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`,
          aircraft,
          cabin_classes: {
            economy: { price, available: 5 + (seed % 20) },
            premium_economy: {
              price: Math.round(price * 1.4),
              available: 2 + (seed % 8),
            },
            business: {
              price: Math.round(price * 2.8),
              available: seed % 6,
            },
            first:
              seed % 4 === 0 ? { price: price * 5, available: seed % 3 } : null,
          },
        };
      });

    return {
      origin,
      destination,
      departure_date,
      return_date: return_date || null,
      trip_type: return_date ? "round_trip" : "one_way",
      offset,
      count: 10,
      total_results: 47 + (routeHash % 30),
      flights,
    };
  }
}

// --- hotel_search ---
const hotelSearchSchema = z.object({
  location: z.string().describe("City or area to search for hotels"),
  check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
  check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe("Pagination offset, returns 30 results starting from offset"),
});

export class HotelSearchTool extends ToolBase<typeof hotelSearchSchema> {
  readonly description =
    "Search for available hotels in a location for specific dates";
  readonly inputSchema = hotelSearchSchema;

  execute({
    location,
    check_in,
    check_out,
    offset,
  }: z.infer<typeof hotelSearchSchema>) {
    const hotelPrefixes = [
      "Grand",
      "Royal",
      "The",
      "Hotel",
      "Boutique",
      "Luxe",
      "Urban",
      "Park",
      "Harbor",
      "Vista",
    ];
    const hotelSuffixes = [
      "Palace",
      "Inn",
      "Suites",
      "Resort",
      "Lodge",
      "House",
      "Hotel",
      "Residences",
      "Place",
      "Tower",
    ];
    const chains = [
      "Marriott",
      "Hilton",
      "Hyatt",
      "IHG",
      "Wyndham",
      "Best Western",
      "Accor",
      "Independent",
    ];
    const amenitiesList = [
      "Free WiFi",
      "Pool",
      "Spa",
      "Fitness Center",
      "Restaurant",
      "Bar",
      "Room Service",
      "Concierge",
      "Business Center",
      "Parking",
      "Pet Friendly",
      "Airport Shuttle",
    ];
    const descriptionTemplates = [
      "A stylish retreat in the heart of {loc}, offering modern comforts and easy access to top attractions.",
      "Set in a quiet corner of {loc}, this property blends classic charm with contemporary amenities.",
      "Perfectly located for business and leisure travelers visiting {loc}, with sweeping views and refined service.",
      "An elegant {loc} property known for its attentive staff, comfortable rooms, and prime location near major sights.",
      "A welcoming escape in {loc} featuring thoughtfully designed rooms and a range of on-site amenities.",
      "Contemporary accommodations in {loc} with a focus on comfort, convenience, and memorable guest experiences.",
    ];
    const reviewTemplates = [
      "Spotless rooms and the staff went above and beyond to make our stay special.",
      "Great location — walking distance to everything we wanted to see.",
      "The bed was incredibly comfortable and the view from the room was stunning.",
      "Breakfast was excellent with a wide variety of fresh options every morning.",
      "Check-in was quick and the concierge gave us fantastic restaurant recommendations.",
      "Rooms were a bit smaller than expected but everything was clean and well maintained.",
      "The pool area was beautifully kept and never felt crowded during our visit.",
      "Quiet despite being in a busy neighborhood — we slept wonderfully every night.",
      "Noise from the street was noticeable at night, but otherwise a pleasant stay.",
      "Fantastic value for the price and the bathroom was surprisingly luxurious.",
      "The lobby is gorgeous and the bar downstairs had an excellent cocktail menu.",
      "Housekeeping was prompt and the bedding felt like a high-end boutique stay.",
    ];
    const reviewerNames = [
      "Sarah M.",
      "David L.",
      "Priya K.",
      "Marco R.",
      "Jenna T.",
      "Hiro S.",
      "Elena V.",
      "James O.",
      "Chloe B.",
      "Anders J.",
    ];

    const locationHash = location
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);

    const hotels = Array(30)
      .fill(0)
      .map((_, i) => {
        const idx = offset + i;
        const seed = locationHash + idx;

        const prefix = hotelPrefixes[seed % hotelPrefixes.length]!;
        const suffix = hotelSuffixes[(seed + 5) % hotelSuffixes.length]!;
        const chain = chains[seed % chains.length]!;
        const stars = 2 + (seed % 4);
        const basePrice = 80 + stars * 40 + ((seed * 13) % 200);
        const rating = 3.5 + (seed % 15) / 10;

        const numAmenities = 4 + (seed % 4);
        const amenities = amenitiesList
          .slice(0, numAmenities)
          .sort(() => (seed % 2 === 0 ? 1 : -1));

        const description = descriptionTemplates[
          seed % descriptionTemplates.length
        ]!.replace("{loc}", location.split(",")[0]!);

        const reviews = Array(4)
          .fill(0)
          .map((__, r) => {
            const rSeed = seed * 31 + r * 7;
            return {
              reviewer: reviewerNames[rSeed % reviewerNames.length]!,
              stars: 3 + (rSeed % 3),
              notes: reviewTemplates[rSeed % reviewTemplates.length]!,
            };
          });

        return {
          hotel_id: `HTL${String(seed).padStart(5, "0")}`,
          name: `${prefix} ${suffix} ${location.split(",")[0]}`,
          chain: chain === "Independent" ? null : chain,
          star_rating: stars,
          guest_rating: Math.round(rating * 10) / 10,
          reviews_count: 100 + ((seed * 7) % 2000),
          price_per_night: Math.round(basePrice),
          total_price: Math.round(basePrice * 3),
          distance_to_center: `${(0.2 + (seed % 50) / 10).toFixed(1)} km`,
          amenities,
          room_types_available: 2 + (seed % 4),
          free_cancellation: seed % 3 !== 0,
          breakfast_included: seed % 4 === 0,
          description,
          reviews,
        };
      });

    return {
      location,
      check_in,
      check_out,
      offset,
      count: 30,
      total_results: 85 + (locationHash % 50),
      hotels,
    };
  }
}

// --- hotel_detail ---
const hotelDetailInputSchema = z.object({
  hotel_id: z.string().describe("The hotel ID from search results"),
  hotel_name: z
    .string()
    .optional()
    .describe("Hotel name for context (helps generate accurate details)"),
  location: z
    .string()
    .optional()
    .describe("Location for context (helps generate accurate details)"),
});

const hotelDetailOutputSchema = z.object({
  hotel_id: z.string(),
  name: z.string(),
  description: z.string().describe("2-3 sentence description of the hotel"),
  star_rating: z.number().min(1).max(5),
  address: z.string(),
  neighborhood: z.string(),
  room_types: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      price_per_night: z.number(),
      max_guests: z.number(),
      amenities: z.array(z.string()),
    })
  ),
  hotel_amenities: z.array(z.string()),
  check_in_time: z.string(),
  check_out_time: z.string(),
  cancellation_policy: z.string(),
  reviews_summary: z.object({
    average_rating: z.number(),
    total_reviews: z.number(),
    highlights: z.array(z.string()).describe("3-4 common positive mentions"),
    concerns: z.array(z.string()).describe("1-2 common concerns if any"),
  }),
});

export class HotelDetailTool extends ToolFromLLM<
  typeof hotelDetailInputSchema,
  typeof hotelDetailOutputSchema
> {
  readonly description =
    "Get detailed information about a specific hotel including room types, amenities, and policies";
  readonly inputSchema = hotelDetailInputSchema;
  readonly outputSchema = hotelDetailOutputSchema;
  readonly system =
    "You are a travel data generator. Create realistic, detailed hotel information. Be specific and creative with details.";

  prompt({
    hotel_id,
    hotel_name,
    location,
  }: z.infer<typeof hotelDetailInputSchema>) {
    return `Generate realistic hotel details for:
Hotel ID: ${hotel_id}
${hotel_name ? `Hotel Name: ${hotel_name}` : ""}
${location ? `Location: ${location}` : ""}

Create believable, detailed information that would appear on a travel booking site.`;
  }
}

// --- attractions ---
const attractionsInputSchema = z.object({
  location: z.string().describe("City or area to find attractions"),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe("Pagination offset, returns 30 results starting from offset"),
});

const attractionsOutputSchema = z.object({
  location: z.string(),
  attractions: z.array(
    z.object({
      attraction_id: z.string(),
      name: z.string(),
      type: z.string().describe("e.g., museum, landmark, park, market"),
      description: z.string().describe("2-3 sentences"),
      rating: z.number().min(1).max(5),
      typical_duration: z.string().describe("e.g., 2-3 hours"),
      admission_price: z.string().describe("e.g., $25 or Free"),
      hours: z.string(),
      address: z.string(),
      tips: z.string().describe("A helpful tip for visitors"),
    })
  ),
  total_available: z.number().describe("Estimated total attractions in area"),
});

export class AttractionsTool extends ToolFromLLM<
  typeof attractionsInputSchema,
  typeof attractionsOutputSchema
> {
  readonly description =
    "Get popular attractions and points of interest in a location";
  readonly inputSchema = attractionsInputSchema;
  readonly outputSchema = attractionsOutputSchema;
  readonly system =
    "You are a travel data generator. Create realistic attraction listings that would appear on a travel site. Use realistic names and details appropriate for the location.";

  prompt({ location, offset }: z.infer<typeof attractionsInputSchema>) {
    return `Generate a list of 30 popular attractions in ${location}.
Offset: ${offset} (so if offset is 30, give attractions 31-60, etc.)

Include a mix of: landmarks, museums, parks, markets, neighborhoods, and unique local experiences.
Make them realistic - use real or realistic-sounding names appropriate for the location.`;
  }
}

// --- activities ---
const activitiesInputSchema = z.object({
  location: z.string().describe("City or area for activities"),
  date: z.string().describe("Date for the activity (YYYY-MM-DD)"),
  type: z
    .string()
    .optional()
    .describe(
      "Optional filter: tour, food, adventure, cultural, wellness, nightlife"
    ),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe("Pagination offset, returns 30 results starting from offset"),
});

const activitiesOutputSchema = z.object({
  location: z.string(),
  date_range: z.string(),
  activities: z.array(
    z.object({
      activity_id: z.string(),
      name: z.string(),
      type: z
        .string()
        .describe("e.g., tour, cooking class, adventure, cultural"),
      description: z.string().describe("2-3 sentences"),
      duration: z.string(),
      price_per_person: z.number(),
      available_times: z.array(z.string()),
      group_size: z.string().describe("e.g., Small group (max 8)"),
      includes: z.array(z.string()),
      rating: z.number().min(1).max(5),
      reviews_count: z.number(),
    })
  ),
  total_available: z.number(),
});

export class ActivitiesTool extends ToolFromLLM<
  typeof activitiesInputSchema,
  typeof activitiesOutputSchema
> {
  readonly description =
    "Search for bookable activities and experiences like tours, classes, and adventures";
  readonly inputSchema = activitiesInputSchema;
  readonly outputSchema = activitiesOutputSchema;
  readonly system =
    "You are a travel data generator. Create realistic bookable activity listings. Include specific details about duration, group size, what's included, and pricing.";

  prompt({
    location,
    date,
    type,
    offset,
  }: z.infer<typeof activitiesInputSchema>) {
    return `Generate 30 bookable activities/experiences in ${location} for ${date}.
${type ? `Filter by type: ${type}` : "Include a variety: tours, food experiences, adventures, cultural activities, etc."}
Offset: ${offset}

Make them realistic - use compelling names and descriptions that would appear on Viator or GetYourGuide.`;
  }
}
