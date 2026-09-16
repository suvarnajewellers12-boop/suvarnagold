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
    const {
      customerName, phoneNumber, itemName, itemDescription,
      metalType, purity, pricingMode = "GRAMS", pieceCost = 0,
      liveRate, netWeight, stoneWeight, vaPercentage, stoneCost,
      exchangeJewelleryName, exchangeJewelleryGrams, discountAmount,
      deadlineDate,
    } = body;

    if (!customerName || !phoneNumber || !itemName) {
      return NextResponse.json({ error: "Customer name, phone number and item name are required" }, { status: 400, headers: corsHeaders() });
    }

    const normalizedMetal = String(metalType || "").toUpperCase();
    const normalizedPurity = String(purity || "");
    const requestedPricingMode = String(pricingMode || "GRAMS").toUpperCase();
    const isPieceCost =
      normalizedMetal === "SILVER" &&
      normalizedPurity === "92.5" &&
      requestedPricingMode === "PIECE";

    const netWeightValue = isPieceCost ? 0 : Math.max(0, Number(netWeight) || 0);
    const pieceCostValue = isPieceCost ? Math.max(0, Number(pieceCost) || 0) : 0;
    const liveRateValue = isPieceCost ? 0 : Math.max(0, Number(liveRate) || 0);
    const vaPercentageValue = isPieceCost ? 0 : Math.max(0, Number(vaPercentage) || 0);
    const stoneWeightValue = Math.max(0, Number(stoneWeight) || 0);
    const stoneCostValue = Math.max(0, Number(stoneCost) || 0);
    const exchangeValue = Math.max(0, Number(discountAmount) || 0);

    if (isPieceCost ? pieceCostValue <= 0 : netWeightValue <= 0) {
      return NextResponse.json(
        { error: isPieceCost ? "Piece Cost must be greater than 0" : "Grams required must be greater than 0" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const metalValue = roundMoney(isPieceCost ? pieceCostValue : netWeightValue * liveRateValue);
    const vaAmount = isPieceCost ? 0 : roundMoney(metalValue * (vaPercentageValue / 100));
    const gstTaxableBase = roundMoney(metalValue + vaAmount + stoneCostValue);
    const gstAmount = roundMoney(gstTaxableBase * 0.03);
    const originalCartValue = roundMoney(gstTaxableBase + gstAmount);
    const totalAmount = roundMoney(Math.max(0, originalCartValue - exchangeValue));

    // Split initial payment. Each selected mode becomes its own Payment row.
    // Legacy single-mode payload is still accepted.
    let rawInitialPayments: any[] = [];
    if (Array.isArray(body.initialPayments)) {
      rawInitialPayments = body.initialPayments;
    } else if (Number(body.advanceCash || 0) > 0) {
      rawInitialPayments = [{
        amount: body.advanceCash,
        mode: body.advancePaymentMode || "CASH",
        referenceNumber: body.advanceReferenceNumber,
        checkNumber: body.advanceCheckNumber,
        bankName: body.advanceBankName,
        note: "Initial payment",
      }];
    }

    const normalized = normalizePayments(rawInitialPayments, "Initial payment");
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400, headers: corsHeaders() });
    }

    const initialPaymentTotal = roundMoney(
      normalized.payments.reduce((sum, p) => sum + p.amount, 0)
    );
    if (initialPaymentTotal > totalAmount + 0.01) {
      return NextResponse.json(
        { error: `Initial payment cannot be greater than payable amount ₹${totalAmount.toLocaleString("en-IN")}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const deadline = deadlineDate ? new Date(deadlineDate) : null;
    if (deadline && Number.isNaN(deadline.getTime())) {
      return NextResponse.json({ error: "Invalid deadline date" }, { status: 400, headers: corsHeaders() });
    }

    const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: "desc" } });
    const previousNumber = lastOrder ? Number.parseInt(lastOrder.orderId.replace("OR-", ""), 10) : 1000;
    const orderId = `OR-${Number.isFinite(previousNumber) ? previousNumber + 1 : 1001}`;

    const order = await prisma.order.create({
      data: {
        orderId,
        customerName,
        phoneNumber,
        itemName,
        itemDescription: itemDescription || null,
        metalType: normalizedMetal,
        purity: normalizedPurity,
        pricingMode: isPieceCost ? "PIECE" : "GRAMS",
        pieceCost: pieceCostValue,
        liveRate: liveRateValue,
        netWeight: netWeightValue,
        stoneWeight: stoneWeightValue,
        grossWeight: roundMoney(netWeightValue + stoneWeightValue),
        vaPercentage: vaPercentageValue,
        stoneCost: stoneCostValue,
        gst: gstAmount,
        originalCartValue,
        exchangeJewelleryName: exchangeJewelleryName || null,
        exchangeJewelleryGrams: Math.max(0, Number(exchangeJewelleryGrams) || 0),
        discountAmount: exchangeValue,
        totalAmount,
        advanceCash: initialPaymentTotal,
        balanceAmount: roundMoney(Math.max(0, totalAmount - initialPaymentTotal)),
        weightAdjustmentGrams: 0,
        adjustmentCost: 0,
        pricingRevisionAmount: 0,
        pricingRevisionNote: null,
        deadlineDate: deadline,
        status: "NOT ASSIGNED",
        createdBy: decoded.id,
        payments: normalized.payments.length
          ? {
              create: normalized.payments.map((p) => ({
                amount: p.amount,
                mode: p.mode,
                referenceNumber: p.referenceNumber,
                checkNumber: p.checkNumber,
                bankName: p.bankName,
                note: "Initial payment",
                paidAt: p.paidAt,
                createdBy: decoded.id,
              })),
            }
          : undefined,
      },
      include: { payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] } },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Order created",
        orderId: order.orderId,
        order,
        calculation: {
          metalValue, vaAmount, stoneCost: stoneCostValue, gstAmount,
          originalCartValue, exchangeValue, totalAmount,
          initialPayment: initialPaymentTotal,
          balanceAmount: order.balanceAmount,
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error: any) {
    console.error("CREATE_ORDER_ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message || "Unknown error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
