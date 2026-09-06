import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { PaymentMode } from "@prisma/client";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CARD", "CHECK"];

export async function POST(req: Request) {
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

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const body = await req.json();
    const {
      orderId,
      amount,
      note,
      paidAt,
      mode = "CASH",
      referenceNumber,
      bankName,
      checkNumber,
    } = body;

    if (!orderId) {
      return new NextResponse(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return new NextResponse(JSON.stringify({ error: "Payment amount must be greater than 0" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const paymentMode = String(mode).toUpperCase() as PaymentMode;
    if (!PAYMENT_MODES.includes(paymentMode)) {
      return new NextResponse(JSON.stringify({ error: "Invalid payment mode" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    if (paymentMode === "CHECK" && !String(checkNumber || "").trim()) {
      return new NextResponse(JSON.stringify({ error: "Check number is required" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return new NextResponse(JSON.stringify({ error: "Invalid payment date" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return new NextResponse(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    }

    if (order.status === "DELIVERED") {
      return new NextResponse(
        JSON.stringify({ error: "Order is already delivered and fully settled — cannot add further payments" }),
        { status: 409, headers: corsHeaders() }
      );
    }

    if (amountValue > order.balanceAmount + 0.01) {
      return new NextResponse(
        JSON.stringify({ error: `Payment exceeds remaining balance of ₹${order.balanceAmount.toLocaleString()}` }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const [, updatedOrder] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId,
          amount: amountValue,
          mode: paymentMode,
          referenceNumber:
            paymentMode === "UPI" || paymentMode === "CARD"
              ? String(referenceNumber || "").trim() || null
              : null,
          checkNumber:
            paymentMode === "CHECK" ? String(checkNumber || "").trim() || null : null,
          bankName:
            paymentMode === "CHECK" ? String(bankName || "").trim() || null : null,
          note: String(note || "").trim() || null,
          paidAt: paymentDate,
          createdBy: decoded.id,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          // advanceCash is the cached TOTAL received, despite its old field name.
          advanceCash: { increment: amountValue },
          balanceAmount: Math.max(0, order.balanceAmount - amountValue),
        },
        include: {
          payments: { orderBy: { paidAt: "asc" } },
        },
      }),
    ]);

    return new NextResponse(
      JSON.stringify({ success: true, message: "Payment recorded", order: updatedOrder }),
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("PAYMENT_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to record payment", details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
