import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const coupons = await prisma.coupon.findMany({
      include: {
        customer: {
          select: { name: true, phone: true },
        },
        scheme: {
          select: { id: true, name: true },
        },
        customerScheme: {
          select: {
            startDate: true,
            isCompleted: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = coupons.map((c) => {
      // Determine status
      let status: "Active" | "Locked" | "Redeemed";
      if (c.isUsed) {
        status = "Redeemed";
      } else if (!c.isActive) {
        status = "Locked";
      } else {
        status = "Active";
      }

      return {
        id: c.id,
        couponCode: c.code,
        createdAt: c.createdAt.toISOString(),
        activeDate: c.customerScheme?.startDate?.toISOString() ?? null,
        redeemedAt: c.usedAt?.toISOString() ?? null,
        invoiceNumber: c.invoiceNumber ?? null,
        weightAssigned: c.totalWeightGrams,
        redeemedValue: c.totalCashValue,
        status,
        schemeCode: c.scheme?.id ?? null,
        schemeName: c.scheme?.name ?? null,
        customerName: c.customer.name,
        customerPhone: c.customer.phone,
        type: c.type,
        value: c.value,
        description: c.description ?? null,
        isPreClosed: c.isPreClosed,
        preClosedAt: c.preClosedAt?.toISOString() ?? null,
      };
    });

    return new NextResponse(JSON.stringify({ coupons: mapped }), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Coupon fetch error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
