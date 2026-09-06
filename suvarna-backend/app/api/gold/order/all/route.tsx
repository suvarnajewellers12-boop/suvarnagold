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
    const decoded = verifyToken(token) as unknown as { role?: string };

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const orders = await prisma.order.findMany({
      select: {
        id: true,
        orderId: true,
        customerName: true,
        phoneNumber: true,
        itemName: true,
        itemDescription: true,
        metalType: true,
        purity: true,
        liveRate: true,
        stoneWeight: true,
        netWeight: true,
        grossWeight: true,
        vaPercentage: true,
        stoneCost: true,
        gst: true,
        originalCartValue: true,
        exchangeJewelleryName: true,
        exchangeJewelleryGrams: true,
        totalAmount: true,
        advanceCash: true,
        discountAmount: true,
        balanceAmount: true,
        weightAdjustmentGrams: true,
        adjustmentCost: true,
        deadlineDate: true,
        createdAt: true,
        createdBy: true,
        status: true,
        jobWorkId: true,
        payments: {
          select: {
            id: true,
            amount: true,
            mode: true,
            referenceNumber: true,
            checkNumber: true,
            bankName: true,
            note: true,
            paidAt: true,
            createdBy: true,
            createdAt: true,
          },
          orderBy: { paidAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return new NextResponse(
      JSON.stringify({ success: true, count: orders.length, orders }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}
