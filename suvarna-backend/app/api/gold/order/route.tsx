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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token) as { id: string; role: string };

    if (
      !decoded ||
      (decoded.role !== "SUPER_ADMIN" && decoded.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();

    const {
      customerName,
      phoneNumber,
      itemName,
      itemDescription,
      metalType,
      purity,

      // GRAMS pricing
      liveRate,
      netWeight,
      vaPercentage,

      // PIECE pricing — Silver 92.5 only
      pricingMode = "GRAMS",
      pieceCost = 0,

      stoneWeight,
      stoneCost,

      exchangeJewelleryName,
      exchangeJewelleryGrams,
      discountAmount,
      deadlineDate,

      advanceCash,
      advancePaymentMode,
      advanceReferenceNumber,
      advanceBankName,
      advanceCheckNumber,
    } = body;

    const normalizedMetal = String(metalType || "").toUpperCase();
    const normalizedPurity = String(purity || "");
    const normalizedPricingMode =
      String(pricingMode || "GRAMS").toUpperCase() === "PIECE"
        ? "PIECE"
        : "GRAMS";

    const isSilver925 =
      normalizedMetal === "SILVER" &&
      normalizedPurity === "92.5";

    const isPieceCost =
      isSilver925 &&
      normalizedPricingMode === "PIECE";

    const netWeightValue = isPieceCost
      ? 0
      : Math.max(0, Number(netWeight) || 0);

    const pieceCostValue = isPieceCost
      ? Math.max(0, Number(pieceCost) || 0)
      : 0;

    if (isPieceCost) {
      if (pieceCostValue <= 0) {
        return NextResponse.json(
          { error: "Piece Cost must be greater than 0 for 92.5 silver piece pricing" },
          { status: 400, headers: corsHeaders() }
        );
      }
    } else if (netWeightValue <= 0) {
      return NextResponse.json(
        { error: "Grams required to make the item must be greater than 0" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const deadline = deadlineDate ? new Date(deadlineDate) : null;

    if (deadlineDate && (!deadline || Number.isNaN(deadline.getTime()))) {
      return NextResponse.json(
        { error: "Invalid deadline date" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const rawInitialPayment = Math.max(0, Number(advanceCash) || 0);
    const mode = String(advancePaymentMode || "CASH").toUpperCase() as PaymentMode;

    if (rawInitialPayment > 0 && !PAYMENT_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "Invalid initial payment mode" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (
      rawInitialPayment > 0 &&
      mode === "CHECK" &&
      !String(advanceCheckNumber || "").trim()
    ) {
      return NextResponse.json(
        { error: "Check number is required for check payment" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const lastOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const previousNumber = lastOrder
      ? Number.parseInt(lastOrder.orderId.replace("OR-", ""), 10)
      : 1000;

    const orderId = `OR-${
      Number.isFinite(previousNumber) ? previousNumber + 1 : 1001
    }`;

    const liveRateValue = isPieceCost
      ? 0
      : Math.max(0, Number(liveRate) || 0);

    const vaPercentageValue = isPieceCost
      ? 0
      : Math.max(0, Number(vaPercentage) || 0);

    const stoneWeightValue = Math.max(0, Number(stoneWeight) || 0);
    const stoneCostValue = Math.max(0, Number(stoneCost) || 0);
    const discountAmountValue = Math.max(0, Number(discountAmount) || 0);

    // ------------------------------------------------------------
    // PRICING
    // ------------------------------------------------------------
    // GRAMS:
    // metalValue = netWeight × liveRate
    // VA applies.
    //
    // PIECE COST (Silver 92.5 only):
    // metalValue = pieceCost
    // VA = 0.
    const metalValue = roundMoney(
      isPieceCost
        ? pieceCostValue
        : netWeightValue * liveRateValue
    );

    const vaAmount = isPieceCost
      ? 0
      : roundMoney(
          metalValue * (vaPercentageValue / 100)
        );

    // GST always applies after Metal Value + VA + Stone Cost.
    // For piece-cost orders VA is zero.
    const gstTaxableBase = roundMoney(
      metalValue +
      vaAmount +
      stoneCostValue
    );

    const gstAmount = roundMoney(
      gstTaxableBase * 0.03
    );

    const originalCartValue = roundMoney(
      gstTaxableBase +
      gstAmount
    );

    // Exchange is deducted after GST.
    const totalAmount = roundMoney(
      Math.max(
        0,
        originalCartValue -
        discountAmountValue
      )
    );

    const initialPayment =
      rawInitialPayment > totalAmount &&
      Math.abs(rawInitialPayment - Math.round(totalAmount)) < 0.01
        ? totalAmount
        : roundMoney(rawInitialPayment);

    if (initialPayment > totalAmount + 0.01) {
      return NextResponse.json(
        {
          error: `Initial payment cannot be greater than the payable amount (${totalAmount.toFixed(2)})`,
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const balanceAmount = roundMoney(
      Math.max(
        0,
        totalAmount -
        initialPayment
      )
    );

    const grossWeight = isPieceCost
      ? stoneWeightValue
      : roundMoney(
          netWeightValue +
          stoneWeightValue
        );

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
        grossWeight,
        vaPercentage: vaPercentageValue,
        stoneCost: stoneCostValue,

        gst: gstAmount,
        originalCartValue,

        exchangeJewelleryName: exchangeJewelleryName || null,
        exchangeJewelleryGrams: Math.max(
          0,
          Number(exchangeJewelleryGrams) || 0
        ),
        discountAmount: discountAmountValue,

        totalAmount,
        advanceCash: initialPayment,
        balanceAmount,

        weightAdjustmentGrams: 0,
        adjustmentCost: 0,

        pricingRevisionAmount: 0,
        pricingRevisionNote: null,

        deadlineDate: deadline,
        status: "NOT ASSIGNED",
        createdBy: decoded.id,

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
                    mode === "CHECK"
                      ? String(advanceCheckNumber || "").trim() || null
                      : null,
                  bankName:
                    mode === "CHECK"
                      ? String(advanceBankName || "").trim() || null
                      : null,
                  note: "Initial payment",
                  paidAt: new Date(),
                  createdBy: decoded.id,
                },
              }
            : undefined,
      },
      include: {
        payments: {
          orderBy: { paidAt: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Order created",
        orderId: order.orderId,
        order,
        calculation: {
          pricingMode: order.pricingMode,
          metalValue,
          pieceCost: pieceCostValue,
          netWeight: netWeightValue,
          liveRate: liveRateValue,
          vaPercentage: vaPercentageValue,
          vaAmount,
          stoneCost: stoneCostValue,
          gstTaxableBase,
          gstAmount,
          originalCartValue,
          exchangeValue: discountAmountValue,
          totalAmount,
          initialPayment,
          balanceAmount,
        },
      },
      {
        status: 201,
        headers: corsHeaders(),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error("CREATE_ORDER_ERROR:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: message,
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}
