import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { verifyToken } from "../../../../../../lib/auth";
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    // 1. AUTHORIZATION CHECK
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders()
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403, headers: corsHeaders()
      });
    }

    // 2. OPTIONAL QUERY PARAMS
    // e.g. GET /api/credit-notes?isUsed=false&code=RTN-XXXX
    const { searchParams } = new URL(req.url);
    const isUsedParam = searchParams.get("isUsed");   // "true" | "false" | null (all)
    const codeParam   = searchParams.get("code");     // filter by coupon code
    const invoiceParam = searchParams.get("invoice"); // filter by invoice ID

    // Build a dynamic where clause
    const where: Record<string, any> = {};

    if (isUsedParam !== null) {
      where.isUsed = isUsedParam === "true";
    }
    if (codeParam) {
      where.code = { contains: codeParam.toUpperCase(), mode: "insensitive" };
    }
    if (invoiceParam) {
      where.invoice = { contains: invoiceParam.toUpperCase(), mode: "insensitive" };
    }

    // 3. FETCH FROM DB
    const coupons = await prisma.returnCoupon.findMany({
      where,
      include: {
        creditNotes: true,
      },
      orderBy: {
        createdAt: "desc", // newest first
      },
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        total: coupons.length,
        coupons,
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("CREDIT_NOTE_FETCH_ERROR:", error);
    const status = error.name === "JsonWebTokenError" ? 401 : 500;

    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status, headers: corsHeaders() }
    );
  }
}