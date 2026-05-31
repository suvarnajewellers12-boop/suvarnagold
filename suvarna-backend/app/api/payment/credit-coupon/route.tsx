import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PATCH,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function PATCH(req: Request) {
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

    // 2. PARSE BODY
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return new NextResponse(
        JSON.stringify({ error: "A valid coupon code is required" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 3. EXECUTE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {

      // Find the coupon first
      const existing = await tx.returnCoupon.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!existing) {
        throw Object.assign(new Error("Coupon not found"), { statusCode: 404 });
      }

      if (existing.isUsed) {
        throw Object.assign(
          new Error("Coupon has already been redeemed"),
          { statusCode: 409 }
        );
      }

      // Mark as used
      const updated = await tx.returnCoupon.update({
        where: { code: code.toUpperCase() },
        data: { isUsed: true },
        include: { creditNotes: true },
      });

      return {
        couponCode:  updated.code,
        totalAmount: updated.cashAmount,
        isUsed:      updated.isUsed,
        invoice:     updated.invoice,
        pastInvoice: updated.pastinvoice,
        redeemedAt:  new Date().toISOString(),
      };

    }, {
      maxWait: 15000,
      timeout:  45000,
    });

    return new NextResponse(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("CREDIT_NOTE_REDEEM_ERROR:", error);

    // Surface custom status codes thrown inside the transaction
    const status =
      error.statusCode === 404 ? 404 :
      error.statusCode === 409 ? 409 :
      error.name === "JsonWebTokenError" ? 401 : 500;

    return new NextResponse(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status, headers: corsHeaders() }
    );
  }
}