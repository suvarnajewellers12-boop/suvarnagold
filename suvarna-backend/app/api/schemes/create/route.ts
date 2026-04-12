import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// 🔹 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

// 🔹 Handle Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// ================= CREATE SCHEME (ADMIN ONLY) =================
export async function POST(req: Request) {
  try {
    // 🔐 Authorization Header Check
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid Token" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    // 🔐 Role Check
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Only Admin can create schemes" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // 🔹 Parse Body
    const body = await req.json();

    const {
      name,
      durationMonths,    // Tenure (Mo.)
      monthlyAmount,     // Monthly Contribution
      maturityAmount,    // Expected Maturity
    } = body;

    // Validation
    if (!name || !durationMonths || !monthlyAmount || !maturityAmount) {
      return new NextResponse(
        JSON.stringify({ error: "Name, Tenure, Monthly Contribution, and Maturity Amount are required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🔹 Create Scheme Template
    // Note: completionCoupon is set to null because it's no longer used as an input
    // issuedCouponCodes starts as an empty array []
    const scheme = await prisma.scheme.create({
      data: {
        name,
        durationMonths: Number(durationMonths),
        monthlyAmount: Number(monthlyAmount),
        maturityAmount: Number(maturityAmount),
        completionCoupon: null, 
        issuedCouponCodes: [], 
      },
    });

    return new NextResponse(
      JSON.stringify({
        message: "Scheme template created successfully",
        scheme,
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("Scheme create error:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}