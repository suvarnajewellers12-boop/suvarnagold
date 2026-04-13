import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 Your Gold API Integration helper
// Update this with your actual external API call logic
async function fetchLiveGoldRate() {
  try {
    // Example: const res = await fetch("https://api.goldrate.com/v1/24k");
    // const data = await res.json();
    // return data.price;
    return 7850; // Mocking the 24K price per gram for logic flow
  } catch (error) {
    console.error("Gold API Fetch Error:", error);
    return null;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN")) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { name, category, durationMonths, monthlyAmount, maturityMonths } = body;

    if (!name || !durationMonths || !monthlyAmount || !category) {
      return new NextResponse(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders() });
    }

    const isWeightBased = category === "Category-B";
    const tenure = Number(durationMonths);
    const monthly = Number(monthlyAmount);

    // Initial scheme data
    let schemeData: any = {
      name,
      durationMonths: tenure,
      monthlyAmount: monthly,
      isWeightBased: isWeightBased,
    };

    // ================= CATEGORY SWITCHING LOGIC =================

    if (isWeightBased) {
      /**
       * CATEGORY-B LOGIC
       * 1. Ignore maturityMonths (set to null).
       * 2. Fetch current 24k rate as a "Starting Reference" for the admin.
       */
      const currentRate = await fetchLiveGoldRate();
      schemeData.maturityMonths = null;

      console.log(`[CAT-B] Initializing Weight-Based Scheme. Current Market: ${currentRate}/g`);
      
    } else {
      /**
       * CATEGORY-A LOGIC
       * 1. Validate Maturity Months (1-25).
       * 2. The total benefit is fixed: (Tenure + MaturityMonths) * Monthly.
       */
      if (!maturityMonths) {
        return new NextResponse(JSON.stringify({ error: "Maturity Months required for Category-A" }), { status: 400, headers: corsHeaders() });
      }
      schemeData.maturityMonths = Number(maturityMonths);
      
      const totalCashBenefit = (tenure + schemeData.maturityMonths) * monthly;
      console.log(`[CAT-A] Initializing Value-Based Scheme. Fixed Benefit: ₹${totalCashBenefit}`);
    }

    // Create the scheme template
    const scheme = await prisma.scheme.create({
      data: schemeData,
    });

    return new NextResponse(
      JSON.stringify({
        message: `${category} created successfully`,
        scheme,
        // Send back the live rate if it's Cat-B so the Admin sees the current value
        currentRate: isWeightBased ? await fetchLiveGoldRate() : null 
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Scheme create error:", error);
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: corsHeaders() });
  }
}