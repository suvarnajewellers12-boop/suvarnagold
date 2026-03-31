import { scrapeGoldRates, scrapeSilverRates } from "@/lib/scraper";
import { getCache, setCache } from "@/lib/cache";

// ✅ Add this helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // 🔥 allow all (or restrict to 8080)
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ✅ Handle preflight (IMPORTANT)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function GET() {
  try {
    const cached = getCache();
    if (cached) {
      return new Response(
        JSON.stringify({
          ...cached,
          cached: true,
        }),
        { headers: corsHeaders() }
      );
    }

    const gold = await scrapeGoldRates();
    const silver = await scrapeSilverRates();

    const response = {
      gold22: gold.gold22,
      gold24: gold.gold24,
      gold18: gold.gold18,
      silver: silver.silver,
      source: "goodreturns",
      updatedAt: new Date().toISOString(),
    };

    setCache(response);

    return new Response(
      JSON.stringify({
        ...response,
        cached: false,
      }),
      { headers: corsHeaders() }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch rates" }),
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}