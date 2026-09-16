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

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

type PaymentInput = {
  amount: number | string;
  mode: PaymentMode | string;
  referenceNumber?: string | null;
  checkNumber?: string | null;
  bankName?: string | null;
  note?: string | null;
  paidAt?: string | Date | null;
};

function normalizePayments(raw: unknown, fallbackNote: string): {
  payments: Array<{
    amount: number;
    mode: PaymentMode;
    referenceNumber: string | null;
    checkNumber: string | null;
    bankName: string | null;
    note: string | null;
    paidAt: Date;
  }>;
  error?: string;
} {
  if (!Array.isArray(raw)) return { payments: [] };

  const payments = [];
  for (const item of raw as PaymentInput[]) {
    const amount = roundMoney(Number(item?.amount) || 0);
    const mode = String(item?.mode || "").toUpperCase() as PaymentMode;

    if (amount <= 0) continue;
    if (!PAYMENT_MODES.includes(mode)) {
      return { payments: [], error: `Invalid payment mode: ${String(item?.mode || "")}` };
    }

    const checkNumber = String(item?.checkNumber || "").trim() || null;
    if (mode === "CHECK" && !checkNumber) {
      return { payments: [], error: "Check number is required for check payment" };
    }

    const paidAt = item?.paidAt ? new Date(item.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return { payments: [], error: "Invalid payment date" };
    }

    payments.push({
      amount,
      mode,
      referenceNumber:
        mode === "UPI" || mode === "CARD"
          ? String(item?.referenceNumber || "").trim() || null
          : null,
      checkNumber: mode === "CHECK" ? checkNumber : null,
      bankName:
        mode === "CHECK"
          ? String(item?.bankName || "").trim() || null
          : null,
      note: String(item?.note || fallbackNote).trim() || fallbackNote,
      paidAt,
    });
  }

  return { payments };
}


export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
    }

    const decoded: any = verifyToken(authHeader.slice(7));
    if (!decoded || (decoded.role !== "SUPER_ADMIN" && decoded.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders() });
    }

    const body = await req.json();
    const { orderId, note } = body;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400, headers: corsHeaders() });
    }

    // New API: payments: [...]
    // Backward compatible: amount/mode/referenceNumber/checkNumber/bankName
    const rawPayments = Array.isArray(body.payments)
      ? body.payments.map((p: any) => ({ ...p, note: p.note ?? note ?? "Order payment" }))
      : [{
          amount: body.amount,
          mode: body.mode || "CASH",
          referenceNumber: body.referenceNumber,
          checkNumber: body.checkNumber,
          bankName: body.bankName,
          paidAt: body.paidAt,
          note: note || "Order payment",
        }];

    const normalized = normalizePayments(rawPayments, "Order payment");
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400, headers: corsHeaders() });
    }
    if (!normalized.payments.length) {
      return NextResponse.json({ error: "Enter at least one payment amount" }, { status: 400, headers: corsHeaders() });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.status === "DELIVERED") throw new Error("ORDER_DELIVERED");

      const paidAgg = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amount: true },
      });
      const paidSoFar = roundMoney(paidAgg._sum.amount || 0);

      // totalAmount already means payable after exchange, before final +/- adjustment.
      const finalPayable = roundMoney(Math.max(0, Number(order.totalAmount || 0) + Number(order.adjustmentCost || 0)));
      const currentBalance = roundMoney(Math.max(0, finalPayable - paidSoFar));
      const incomingTotal = roundMoney(normalized.payments.reduce((sum, p) => sum + p.amount, 0));

      if (incomingTotal > currentBalance + 0.01) {
        throw new Error(`PAYMENT_EXCEEDS:${currentBalance.toFixed(2)}`);
      }

      await tx.payment.createMany({
        data: normalized.payments.map((p) => ({
          orderId,
          amount: p.amount,
          mode: p.mode,
          referenceNumber: p.referenceNumber,
          checkNumber: p.checkNumber,
          bankName: p.bankName,
          note: p.note,
          paidAt: p.paidAt,
          createdBy: decoded.id,
        })),
      });

      const newPaidTotal = roundMoney(paidSoFar + incomingTotal);
      const newBalance = roundMoney(Math.max(0, finalPayable - newPaidTotal));

      return tx.order.update({
        where: { id: orderId },
        data: {
          advanceCash: newPaidTotal,
          balanceAmount: newBalance,
        },
        include: {
          payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "Payment recorded", order: updatedOrder },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    if (error?.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: corsHeaders() });
    }
    if (error?.message === "ORDER_DELIVERED") {
      return NextResponse.json(
        { error: "Order is already delivered and fully settled — cannot add further payments" },
        { status: 409, headers: corsHeaders() }
      );
    }
    if (String(error?.message || "").startsWith("PAYMENT_EXCEEDS:")) {
      const balance = Number(String(error.message).split(":")[1] || 0);
      return NextResponse.json(
        { error: `Payment exceeds remaining balance of ₹${balance.toLocaleString("en-IN")}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    console.error("PAYMENT_ERROR:", error);
    return NextResponse.json(
      { error: "Failed to record payment", details: error?.message || "Unknown error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
