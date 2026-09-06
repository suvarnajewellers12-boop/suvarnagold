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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return new NextResponse(JSON.stringify({ error: "Order ID is required" }), { status: 400, headers: corsHeaders() });
    }

    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      return new NextResponse(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders() });
    }

    if (existing.status === "DELIVERED") {
      return new NextResponse(JSON.stringify({ error: "Order has already been delivered" }), { status: 409, headers: corsHeaders() });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        balanceAmount: 0,
        status: "DELIVERED",
      },
    });

    return new NextResponse(
      JSON.stringify({ success: true, message: "Order settled and issued successfully", order: updatedOrder }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("ISSUE_ORDER_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to issue item", details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}