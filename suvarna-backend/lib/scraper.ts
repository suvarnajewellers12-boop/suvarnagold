import * as cheerio from "cheerio";

// ✅ Common headers (reuse everywhere)
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Referer": "https://www.google.com/",
};

// ✅ Helper: Fetch with retry
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
    } catch (error) {
      console.log(`Retry ${i + 1} for ${url}`);

      if (i === retries - 1) throw error;

      await new Promise((r) => setTimeout(r, 1000)); // wait 1s
    }
  }

  throw new Error("Fetch failed");
}

// 🟡 GOLD SCRAPER
export async function scrapeGoldRates() {
  try {
    const url = "https://www.goodreturns.in/gold-rates/";

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    const prices: string[] = [];

    $("table tr").each((_, el) => {
      const rowText = $(el).text();

      // ✅ Find Chennai row (or India row)
      if (rowText.includes("Mumbai")) {
        $(el)
          .find("td")
          .each((i, td) => {
            const value = $(td).text().trim();

            if (value.includes("₹")) {
              prices.push(value);
            }
          });
      }
    });

    console.log("Extracted Prices:", prices);

    return {
      gold24: prices[0] || "N/A",
      gold22: prices[1] || "N/A",
      gold18: prices[2] || "N/A",
    };
  } catch (error) {
    console.error("Gold scraping error:", error);
    throw new Error("Failed to scrape gold rates");
  }
}

// ⚪ SILVER SCRAPER
export async function scrapeSilverRates() {
  try {
    const url = "https://www.goodreturns.in/silver-rates/";

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    let silver = $("table tr")
      .eq(1)
      .find("td")
      .eq(1)
      .text()
      .trim();

    // ✅ Fallback if selector fails
    if (!silver) {
      const text = $("body").text();
      const match = text.match(/Silver Rate.*?₹\s?([\d,]+)/);

      silver = match ? `₹${match[1]}` : "N/A";
    }

    return { silver };
  } catch (error) {
    console.error("Silver scraping error:", error);
    throw new Error("Failed to scrape silver rates");
  }
}