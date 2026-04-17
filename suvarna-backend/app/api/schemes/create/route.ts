import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}


export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];
    const decoded: any = verifyToken(token || "");

    if (!decoded || (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN")) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();

    const { 
      name, 
      category, 
      durationMonths, 
      monthlyAmount, 
      maturityMonths,
      goldRate24k // Passed from your frontend via the /api/rates call
    } = body;

    // 1. Core Validation
    if (!name || !durationMonths || !monthlyAmount || !category) {
      return new NextResponse(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const isWeightBased = category === "Category-B";
    const tenure = Number(durationMonths);
    const monthly = Number(monthlyAmount);

    let schemeData: any = {
      name,
      durationMonths: tenure,
      monthlyAmount: monthly,
      isWeightBased: isWeightBased,
    };

    // ================= SWITCHING LOGIC =================

    if (isWeightBased) {
      // 🔹 CATEGORY-B: WEIGHT LOGIC
      // We don't need maturityMonths here.
      schemeData.maturityMonths = null;
      
      // We can log or store the 'Reference Rate' at the time of creation
      // so the Admin knows what the market was like when they launched this scheme.
      console.log(`[CAT-B] Scheme Created. Current 24K Rate: ${goldRate24k}`);
      
    } else {
      // 🔹 CATEGORY-A: VALUE LOGIC
      if (!maturityMonths) {
        return new NextResponse(JSON.stringify({ error: "Maturity Months required for Category-A" }), { status: 400 });
      }
      schemeData.maturityMonths = Number(maturityMonths);
    }

    // 2. Database Execution
    const scheme = await prisma.scheme.create({
      data: schemeData,
    });

    return new NextResponse(
      JSON.stringify({
        message: `${category} scheme initialized successfully`,
        scheme,
        marketReference: isWeightBased ? { gold24: goldRate24k } : null
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Scheme creation failed:", error);
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}