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
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const num = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function PATCH(req: Request) {
  try {
    // -------------------------------------------------------------------------
    // AUTH
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.slice(7);
    const decoded: any = verifyToken(token);

    if (
      !decoded ||
      (decoded.role !== "SUPER_ADMIN" && decoded.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403, headers: corsHeaders() }
      );
    }

    // -------------------------------------------------------------------------
    // INPUT
    // -------------------------------------------------------------------------
    const body = await req.json();
    const { orderId, ...fields } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (existing.status === "DELIVERED") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot edit an order that has already been delivered",
        },
        { status: 409, headers: corsHeaders() }
      );
    }

    // -------------------------------------------------------------------------
    // MERGE ONLY ALLOWED FIELDS
    // -------------------------------------------------------------------------
    // advanceCash is intentionally excluded. Payments are changed only through
    // /api/gold/order/payment.
    const editable = [
      "customerName",
      "phoneNumber",
      "itemName",
      "itemDescription",
      "metalType",
      "purity",
      "liveRate",
      "netWeight",
      "stoneWeight",
      "vaPercentage",
      "stoneCost",
      "discountAmount",
      "exchangeJewelleryName",
      "exchangeJewelleryGrams",
      "deadlineDate",
      "weightAdjustmentGrams",
      "adjustmentCost",
      "status",
    ] as const;

    const merged: any = { ...existing };

    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        merged[key] = fields[key];
      }
    }

    // -------------------------------------------------------------------------
    // NORMALIZED INPUTS
    // -------------------------------------------------------------------------
    const liveRate = Math.max(0, num(merged.liveRate));
    const bookedNetWeight = Math.max(0, num(merged.netWeight));
    const stoneWeight = Math.max(0, num(merged.stoneWeight));
    const vaPercentage = Math.max(0, num(merged.vaPercentage));
    const stoneCost = Math.max(0, num(merged.stoneCost));
    const exchangeValue = Math.max(0, num(merged.discountAmount));

    const weightAdjustmentGrams = num(merged.weightAdjustmentGrams);
    const adjustmentCost = num(merged.adjustmentCost);

    const totalPaid = Math.max(0, num(existing.advanceCash));

    // -------------------------------------------------------------------------
    // PHYSICAL WEIGHT ONLY
    // -------------------------------------------------------------------------
    // Adjustment grams affect physical weight display only.
    // They NEVER affect Metal Cost, VA, GST, Original Cart Value or totalAmount.
    const finalPhysicalNetWeight =
      bookedNetWeight + weightAdjustmentGrams;

    const grossWeight =
      finalPhysicalNetWeight + stoneWeight;

    // -------------------------------------------------------------------------
    // CANONICAL PRICING (BOOKED WEIGHT ONLY)
    // -------------------------------------------------------------------------
    const metalCost = roundMoney(
      bookedNetWeight * liveRate
    );

    const vaAmount = roundMoney(
      metalCost * (vaPercentage / 100)
    );

    // GST is ONLY Metal + VA + Stone.
    // Exchange and adjustment are excluded from GST.
    const gstTaxableBase = roundMoney(
      metalCost + vaAmount + stoneCost
    );

    const canonicalGst = roundMoney(
      gstTaxableBase * 0.03
    );

    const canonicalOriginalCartValue = roundMoney(
      gstTaxableBase + canonicalGst
    );

    // -------------------------------------------------------------------------
    // DETECT TRUE PRICING CHANGES
    // -------------------------------------------------------------------------
    // Adjustment-only edits must never be treated as pricing changes.
    const pricingFields = [
      "liveRate",
      "netWeight",
      "vaPercentage",
      "stoneCost",
    ] as const;

    const pricingChanged = pricingFields.some((key) => {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) {
        return false;
      }

      return Math.abs(num(fields[key]) - num((existing as any)[key])) > 0.000001;
    });

    const existingOriginalCartValue =
      Math.max(0, num(existing.originalCartValue));

    const existingGst =
      Math.max(0, num(existing.gst));

    // -------------------------------------------------------------------------
    // SELF-HEAL OLD CORRUPTED ADJUSTMENT ORDERS
    // -------------------------------------------------------------------------
    // Older code priced using:
    //   netWeight + weightAdjustmentGrams
    //
    // That incorrectly changed Original Cart Value when adjustment grams changed.
    //
    // If this order has an adjustment and its stored original differs from the
    // canonical booked-weight calculation, repair it once.
    const hasAdjustment =
      Math.abs(weightAdjustmentGrams) > 0.000001 ||
      Math.abs(adjustmentCost) > 0.000001;

    const looksLegacyCorrupted =
      hasAdjustment &&
      existingOriginalCartValue > 0 &&
      Math.abs(existingOriginalCartValue - canonicalOriginalCartValue) > 0.01;

    const originalCartValue =
      pricingChanged ||
      existingOriginalCartValue <= 0 ||
      looksLegacyCorrupted
        ? canonicalOriginalCartValue
        : roundMoney(existingOriginalCartValue);

    const gstAmount =
      pricingChanged ||
      existingGst <= 0 ||
      looksLegacyCorrupted
        ? canonicalGst
        : roundMoney(existingGst);

    // -------------------------------------------------------------------------
    // EXCHANGE
    // -------------------------------------------------------------------------
    // Exchange is deducted AFTER GST.
    // It does not change Original Cart Value.
    const payableAfterExchange = roundMoney(
      Math.max(0, originalCartValue - exchangeValue)
    );

    // totalAmount deliberately excludes adjustmentCost.
    const totalAmount = payableAfterExchange;

    // -------------------------------------------------------------------------
    // BALANCE
    // -------------------------------------------------------------------------
    const balanceBeforeAdjustment = roundMoney(
      Math.max(0, payableAfterExchange - totalPaid)
    );

    // ONLY the final balance receives adjustment cost.
    //
    // adjustmentCost > 0  => add to balance
    // adjustmentCost < 0  => deduct from balance
    const balanceAmount = roundMoney(
      Math.max(0, balanceBeforeAdjustment + adjustmentCost)
    );

    // -------------------------------------------------------------------------
    // GUARD: cannot mark DELIVERED while a balance is still outstanding
    // -------------------------------------------------------------------------
    const incomingStatus = fields.status || existing.status;

    if (incomingStatus === "DELIVERED" && balanceAmount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot mark order as delivered: balance of ₹${balanceAmount} is still outstanding`,
        },
        { status: 409, headers: corsHeaders() }
      );
    }

    // -------------------------------------------------------------------------
    // DEADLINE
    // -------------------------------------------------------------------------
    let deadlineDate = existing.deadlineDate;

    if (Object.prototype.hasOwnProperty.call(fields, "deadlineDate")) {
      if (!fields.deadlineDate) {
        deadlineDate = null;
      } else {
        const parsed = new Date(fields.deadlineDate);

        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid deadline date",
            },
            { status: 400, headers: corsHeaders() }
          );
        }

        deadlineDate = parsed;
      }
    }

    // -------------------------------------------------------------------------
    // UPDATE
    // -------------------------------------------------------------------------
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        customerName: merged.customerName,
        phoneNumber: merged.phoneNumber,
        itemName: merged.itemName,
        itemDescription: merged.itemDescription,
        metalType: merged.metalType,
        purity: merged.purity,

        liveRate,
        netWeight: bookedNetWeight,
        stoneWeight,
        grossWeight,

        vaPercentage,
        stoneCost,

        discountAmount: exchangeValue,
        exchangeJewelleryName: merged.exchangeJewelleryName,
        exchangeJewelleryGrams: Math.max(
          0,
          num(merged.exchangeJewelleryGrams)
        ),

        deadlineDate,

        weightAdjustmentGrams,
        adjustmentCost,

        gst: gstAmount,
        originalCartValue,
        totalAmount,
        balanceAmount,

        status: fields.status || existing.status,
      },

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
            bankName: true,
            checkNumber: true,
            note: true,
            paidAt: true,
            createdBy: true,
            createdAt: true,
          },
          orderBy: {
            paidAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: looksLegacyCorrupted
          ? "Order updated and old adjustment calculation repaired"
          : "Order updated successfully",
        repairedLegacyAdjustmentCalculation: looksLegacyCorrupted,
        order: updatedOrder,
        calculation: {
          bookedNetWeight,
          weightAdjustmentGrams,
          finalPhysicalNetWeight,

          metalCost,
          vaAmount,
          stoneCost,

          gstTaxableBase,
          gstAmount,

          originalCartValue,
          exchangeValue,
          payableAfterExchange,

          totalPaid,
          balanceBeforeAdjustment,

          adjustmentCost,
          finalBalanceDue: balanceAmount,
        },
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error: any) {
    console.error("EDIT_ORDER_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update order",
        details: error?.message || "Unknown server error",
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}