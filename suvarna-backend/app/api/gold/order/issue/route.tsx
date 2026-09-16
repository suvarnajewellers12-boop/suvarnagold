import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { PaymentMode } from "@prisma/client";

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


export async function PATCH(req: Request) {
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
    const { orderId } = body;
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400, headers: corsHeaders() });
    }

    const normalized = normalizePayments(
      Array.isArray(body.payments)
        ? body.payments.map((p: any) => ({ ...p, note: p.note ?? "Final settlement at pickup" }))
        : [],
      "Final settlement at pickup"
    );
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400, headers: corsHeaders() });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: orderId } });
      if (!existing) throw new Error("ORDER_NOT_FOUND");
      if (existing.status === "DELIVERED") throw new Error("ORDER_DELIVERED");

      const paidAgg = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amount: true },
      });
      const paidSoFar = roundMoney(paidAgg._sum.amount || 0);

      // THIS fixes the positive-adjustment bug.
      // totalAmount = payable after exchange BEFORE final adjustment.
      const finalPayable = roundMoney(
        Math.max(0, Number(existing.totalAmount || 0) + Number(existing.adjustmentCost || 0))
      );
      const remaining = roundMoney(Math.max(0, finalPayable - paidSoFar));

      const settlementTotal = roundMoney(
        normalized.payments.reduce((sum, p) => sum + p.amount, 0)
      );

      if (remaining > 0.01 && normalized.payments.length === 0) {
        throw new Error(`SETTLEMENT_REQUIRED:${remaining.toFixed(2)}`);
      }

      if (Math.abs(settlementTotal - remaining) > 0.01) {
        throw new Error(`SETTLEMENT_MISMATCH:${remaining.toFixed(2)}:${settlementTotal.toFixed(2)}`);
      }

      if (normalized.payments.length) {
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
      }

      const finalPaidTotal = roundMoney(paidSoFar + settlementTotal);

      return tx.order.update({
        where: { id: orderId },
        data: {
          advanceCash: finalPaidTotal,
          balanceAmount: 0,
          status: "DELIVERED",
        },
        include: {
          payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
        },
      });
    });

    return NextResponse.json(
      { success: true, message: "Order settled and issued successfully", order: updatedOrder },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    if (error?.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found" }, { status: 404, headers: corsHeaders() });
    }
    if (error?.message === "ORDER_DELIVERED") {
      return NextResponse.json({ error: "Order has already been delivered" }, { status: 409, headers: corsHeaders() });
    }
    if (String(error?.message || "").startsWith("SETTLEMENT_REQUIRED:")) {
      const remaining = Number(String(error.message).split(":")[1] || 0);
      return NextResponse.json(
        { error: `Final settlement payment of ₹${remaining.toLocaleString("en-IN")} is required before delivery` },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (String(error?.message || "").startsWith("SETTLEMENT_MISMATCH:")) {
      const [, required, received] = String(error.message).split(":");
      return NextResponse.json(
        {
          error: `Settlement split must equal the exact balance. Required ₹${Number(required).toLocaleString("en-IN")}, received ₹${Number(received).toLocaleString("en-IN")}`,
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    console.error("ISSUE_ORDER_ERROR:", error);
    return NextResponse.json(
      { error: "Failed to issue item", details: error?.message || "Unknown error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
