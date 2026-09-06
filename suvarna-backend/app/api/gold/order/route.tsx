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
    const decoded = verifyToken(token) as { id: string; role: string };

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders(),
      });
    }

    const body = await req.json();

    const {
      customerName,
      phoneNumber,
      itemName,
      itemDescription,
      metalType,
      purity,
      liveRate,
      netWeight,
      stoneWeight,
      vaPercentage,
      stoneCost,
      gstAmount,
      originalCartValue,
      exchangeJewelleryName,
      exchangeJewelleryGrams,
      totalAmount,
      advanceCash,
      discountAmount,
      deadlineDate,

      // Initial payment details from frontend.
      advancePaymentMode,
      advanceReferenceNumber,
      advanceBankName,
      advanceCheckNumber,
    } = body;

    const netWeightValue = Number(netWeight) || 0;
    if (netWeightValue <= 0) {
      return new NextResponse(
        JSON.stringify({ error: "Grams required to make the item must be greater than 0" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const deadline = deadlineDate ? new Date(deadlineDate) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      return new NextResponse(JSON.stringify({ error: "Valid deadline date is required" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const initialPayment = Math.max(0, Number(advanceCash) || 0);
    const mode = (advancePaymentMode || "CASH") as PaymentMode;

    if (initialPayment > 0 && !PAYMENT_MODES.includes(mode)) {
      return new NextResponse(JSON.stringify({ error: "Invalid initial payment mode" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    if (initialPayment > 0 && mode === "CHECK" && !String(advanceCheckNumber || "").trim()) {
      return new NextResponse(JSON.stringify({ error: "Check number is required for check payment" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: "desc" } });
    const previousNumber = lastOrder
      ? Number.parseInt(lastOrder.orderId.replace("OR-", ""), 10)
      : 1000;
    const orderId = `OR-${Number.isFinite(previousNumber) ? previousNumber + 1 : 1001}`;

    const liveRateValue = Number(liveRate) || 0;
    const stoneWeightValue = Number(stoneWeight) || 0;
    const vaPercentageValue = Number(vaPercentage) || 0;
    const stoneCostValue = Number(stoneCost) || 0;
    const discountAmountValue = Number(discountAmount) || 0;

    const goldValue = netWeightValue * liveRateValue;
    const vaAmount = goldValue * (vaPercentageValue / 100);
    const subtotalBase = goldValue + vaAmount + stoneCostValue;
    const derivedOriginalCartValue = subtotalBase + subtotalBase * 0.03;

    const totalAmountValue = Math.max(0, Number(totalAmount) || 0);

    if (initialPayment > totalAmountValue + 0.01) {
      return new NextResponse(
        JSON.stringify({ error: "Initial payment cannot be greater than the total order amount" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const order = await prisma.order.create({
      data: {
        orderId,
        customerName,
        phoneNumber,
        itemName,
        itemDescription: itemDescription || null,
        metalType,
        purity,
        liveRate: liveRateValue,
        netWeight: netWeightValue,
        grossWeight: Number(body.grossWeight) || netWeightValue + stoneWeightValue,
        stoneWeight: stoneWeightValue,
        vaPercentage: vaPercentageValue,
        stoneCost: stoneCostValue,
        gst: Number(gstAmount) || 0,
        originalCartValue: Number(originalCartValue) || derivedOriginalCartValue,
        exchangeJewelleryName: exchangeJewelleryName || null,
        exchangeJewelleryGrams: Number(exchangeJewelleryGrams) || 0,
        totalAmount: totalAmountValue,

        // Cached payment totals.
        advanceCash: initialPayment,
        balanceAmount: Math.max(0, totalAmountValue - initialPayment),

        weightAdjustmentGrams: 0,
        adjustmentCost: 0,
        deadlineDate: deadline,
        status: "NOT ASSIGNED",
        discountAmount: discountAmountValue,
        createdBy: decoded.id,

        // Every NEW initial payment is also stored in Payment history.
        payments:
          initialPayment > 0
            ? {
                create: {
                  amount: initialPayment,
                  mode,
                  referenceNumber:
                    mode === "UPI" || mode === "CARD"
                      ? String(advanceReferenceNumber || "").trim() || null
                      : null,
                  checkNumber:
                    mode === "CHECK" ? String(advanceCheckNumber || "").trim() || null : null,
                  bankName:
                    mode === "CHECK" ? String(advanceBankName || "").trim() || null : null,
                  note: "Initial payment",
                  paidAt: new Date(),
                  createdBy: decoded.id,
                },
              }
            : undefined,
      },
      include: {
        payments: { orderBy: { paidAt: "asc" } },
      },
    });

    return new NextResponse(
      JSON.stringify({ success: true, message: "Order created", orderId: order.orderId, order }),
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Data collection error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
