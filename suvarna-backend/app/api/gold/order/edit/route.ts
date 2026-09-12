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

/**
 * Round money values to 2 decimal places.
 */
function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function PATCH(req: Request) {
  try {
    // ============================================================
    // AUTHENTICATION
    // ============================================================

    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        }),
        {
          status: 401,
          headers: corsHeaders(),
        }
      );
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Invalid authorization token",
        }),
        {
          status: 401,
          headers: corsHeaders(),
        }
      );
    }

    const decoded: any = verifyToken(token);

    if (
      !decoded ||
      (
        decoded.role !== "SUPER_ADMIN" &&
        decoded.role !== "ADMIN"
      )
    ) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Forbidden",
        }),
        {
          status: 403,
          headers: corsHeaders(),
        }
      );
    }

    // ============================================================
    // REQUEST BODY
    // ============================================================

    const body = await req.json();

    const {
      orderId,
      ...fields
    } = body;

    if (!orderId) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Order ID is required",
        }),
        {
          status: 400,
          headers: corsHeaders(),
        }
      );
    }

    // ============================================================
    // FIND EXISTING ORDER
    // ============================================================

    const existing = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });

    if (!existing) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Order not found",
        }),
        {
          status: 404,
          headers: corsHeaders(),
        }
      );
    }

    if (existing.status === "DELIVERED") {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error:
            "Cannot edit an order that has already been delivered",
        }),
        {
          status: 409,
          headers: corsHeaders(),
        }
      );
    }

    // ============================================================
    // EDITABLE FIELDS
    // ============================================================
    //
    // advanceCash is intentionally NOT editable here.
    //
    // Money received should only be changed using:
    //
    // POST /api/gold/order/payment
    //
    // ============================================================

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
    ];

    const merged: any = {
      ...existing,
    };

    /**
     * Allow empty strings too.
     *
     * This is useful if the user wants to remove:
     * - exchange jewellery name
     * - description
     * etc.
     *
     * Numeric empty fields will later safely become 0.
     */
    for (const key of editable) {
      if (
        fields[key] !== undefined &&
        fields[key] !== null
      ) {
        merged[key] = fields[key];
      }
    }

    // ============================================================
    // NORMALIZE VALUES
    // ============================================================

    const liveRate = Math.max(
      0,
      parseFloat(String(merged.liveRate)) || 0
    );

    /**
     * IMPORTANT:
     *
     * netWeight is the BOOKED / PRICING weight.
     *
     * Adjustment grams must NOT be added to this
     * when calculating:
     *
     * - Metal Cost
     * - VA
     * - GST
     * - Original Cart Value
     */
    const netWeight = Math.max(
      0,
      parseFloat(String(merged.netWeight)) || 0
    );

    const stoneWeight = Math.max(
      0,
      parseFloat(String(merged.stoneWeight)) || 0
    );

    const vaPercentage = Math.max(
      0,
      parseFloat(String(merged.vaPercentage)) || 0
    );

    const stoneCost = Math.max(
      0,
      parseFloat(String(merged.stoneCost)) || 0
    );

    /**
     * Jewellery exchange value.
     *
     * This is deducted AFTER GST.
     */
    const discountAmount = Math.max(
      0,
      parseFloat(String(merged.discountAmount)) || 0
    );

    /**
     * +/- grams.
     *
     * Physical weight adjustment only.
     *
     * DOES NOT affect:
     * - Metal Cost
     * - VA
     * - GST
     * - Original Cart Value
     */
    const weightAdjustmentGrams =
      parseFloat(
        String(merged.weightAdjustmentGrams)
      ) || 0;

    /**
     * +/- adjustment money.
     *
     * ONLY affects Balance Due.
     *
     * +710 => customer owes ₹710 more
     * -710 => customer owes ₹710 less
     */
    const adjustmentCost =
      parseFloat(
        String(merged.adjustmentCost)
      ) || 0;

    const advanceCash = Math.max(
      0,
      Number(existing.advanceCash) || 0
    );

    // ============================================================
    // PHYSICAL WEIGHT
    // ============================================================

    /**
     * Adjustment grams are allowed to change the
     * final physical produced weight.
     *
     * But they are NOT used for pricing.
     */
    const finalPhysicalNetWeight =
      netWeight +
      weightAdjustmentGrams;

    const grossWeight =
      finalPhysicalNetWeight +
      stoneWeight;

    // ============================================================
    // PRICING CHANGE DETECTION
    // ============================================================

    /**
     * Only these fields are allowed to change
     * Original Cart Value.
     *
     * Notice:
     *
     * weightAdjustmentGrams is NOT here.
     * adjustmentCost is NOT here.
     * discountAmount is NOT here.
     */
    const pricingChanged =
      Number(netWeight) !==
        Number(existing.netWeight || 0) ||

      Number(liveRate) !==
        Number(existing.liveRate || 0) ||

      Number(vaPercentage) !==
        Number(existing.vaPercentage || 0) ||

      Number(stoneCost) !==
        Number(existing.stoneCost || 0);

    // ============================================================
    // METAL COST
    // ============================================================

    /**
     * IMPORTANT:
     *
     * Pricing uses netWeight ONLY.
     *
     * Do NOT use finalPhysicalNetWeight here.
     */
    const metalCost = roundMoney(
      netWeight *
      liveRate
    );

    // ============================================================
    // VA
    // ============================================================

    const vaAmount = roundMoney(
      metalCost *
      (vaPercentage / 100)
    );

    // ============================================================
    // GST TAXABLE BASE
    // ============================================================
    //
    // GST =
    //
    // Metal Cost
    // + VA
    // + Stone Cost
    //
    // Exchange is NOT deducted here.
    //
    // Adjustment Cost is NOT included here.
    //
    // ============================================================

    const gstTaxableBase = roundMoney(
      metalCost +
      vaAmount +
      stoneCost
    );

    const recalculatedGst = roundMoney(
      gstTaxableBase * 0.03
    );

    // ============================================================
    // ORIGINAL CART VALUE
    // ============================================================
    //
    // Original Cart Value =
    //
    // Metal Cost
    // + VA
    // + Stone Cost
    // + GST
    //
    // It MUST NOT change because of:
    //
    // - Exchange
    // - Adjustment Grams
    // - Adjustment Cost
    //
    // ============================================================

    const existingOriginalCartValue =
      Number(existing.originalCartValue) || 0;

    const recalculatedOriginalCartValue =
      roundMoney(
        gstTaxableBase +
        recalculatedGst
      );

    /**
     * If pricing itself changed,
     * recalculate Original Cart Value.
     *
     * Otherwise KEEP THE EXISTING VALUE.
     *
     * This is critical when editing only
     * +/- adjustment grams/cost.
     */
    const originalCartValue =
      pricingChanged ||
      existingOriginalCartValue <= 0
        ? recalculatedOriginalCartValue
        : roundMoney(
            existingOriginalCartValue
          );

    // ============================================================
    // GST
    // ============================================================

    const existingGst =
      Number(existing.gst) || 0;

    /**
     * Same logic:
     *
     * if pricing changes -> recalculate GST
     *
     * if only adjustment changes -> preserve GST
     */
    const gstAmount =
      pricingChanged ||
      existingGst <= 0
        ? recalculatedGst
        : roundMoney(existingGst);

    // ============================================================
    // EXCHANGE
    // ============================================================
    //
    // Exchange happens AFTER GST.
    //
    // Example:
    //
    // Original Cart Value = ₹166,627
    //
    // Jewellery Exchange = ₹50,000
    //
    // Payable =
    //
    // ₹166,627 - ₹50,000
    // = ₹116,627
    //
    // Original ₹166,627 stays unchanged.
    //
    // ============================================================

    const payableAfterExchange =
      roundMoney(
        Math.max(
          0,
          originalCartValue -
          discountAmount
        )
      );

    /**
     * totalAmount stores payable after exchange
     * BEFORE adjustment.
     *
     * Adjustment cost must NOT change this.
     */
    const totalAmount =
      payableAfterExchange;

    // ============================================================
    // BALANCE BEFORE ADJUSTMENT
    // ============================================================

    const balanceBeforeAdjustment =
      roundMoney(
        Math.max(
          0,
          payableAfterExchange -
          advanceCash
        )
      );

    // ============================================================
    // FINAL BALANCE DUE
    // ============================================================
    //
    // ONLY HERE adjustmentCost is applied.
    //
    // Positive:
    //
    // Balance  ₹98,199
    // Adjustment +₹710
    // Final     ₹98,909
    //
    //
    // Negative:
    //
    // Balance  ₹98,199
    // Adjustment -₹710
    // Final     ₹97,489
    //
    // ============================================================

    const balanceAmount =
      roundMoney(
        Math.max(
          0,
          balanceBeforeAdjustment +
          adjustmentCost
        )
      );

    // ============================================================
    // DEADLINE
    // ============================================================

    let deadlineDate = existing.deadlineDate;

    if (fields.deadlineDate !== undefined) {
      if (
        fields.deadlineDate === "" ||
        fields.deadlineDate === null
      ) {
        deadlineDate = null;
      } else {
        const parsedDeadline =
          new Date(fields.deadlineDate);

        if (
          !Number.isNaN(
            parsedDeadline.getTime()
          )
        ) {
          deadlineDate =
            parsedDeadline;
        }
      }
    }

    // ============================================================
    // UPDATE ORDER
    // ============================================================

    const updatedOrder =
      await prisma.order.update({
        where: {
          id: orderId,
        },

        data: {
          // ------------------------------------
          // CUSTOMER
          // ------------------------------------

          customerName:
            merged.customerName,

          phoneNumber:
            merged.phoneNumber,

          // ------------------------------------
          // ITEM
          // ------------------------------------

          itemName:
            merged.itemName,

          itemDescription:
            merged.itemDescription,

          metalType:
            merged.metalType,

          purity:
            merged.purity,

          // ------------------------------------
          // PRICING INPUTS
          // ------------------------------------

          liveRate,

          /**
           * Keep booked/pricing netWeight unchanged
           * by the adjustment.
           */
          netWeight,

          stoneWeight,

          /**
           * grossWeight represents physical weight.
           */
          grossWeight,

          vaPercentage,

          stoneCost,

          // ------------------------------------
          // EXCHANGE
          // ------------------------------------

          discountAmount,

          exchangeJewelleryName:
            merged.exchangeJewelleryName,

          exchangeJewelleryGrams:
            Math.max(
              0,
              parseFloat(
                String(
                  merged.exchangeJewelleryGrams
                )
              ) || 0
            ),

          // ------------------------------------
          // DEADLINE
          // ------------------------------------

          deadlineDate,

          // ------------------------------------
          // BALANCE-ONLY ADJUSTMENTS
          // ------------------------------------

          weightAdjustmentGrams,

          adjustmentCost,

          // ------------------------------------
          // FINANCIAL RESULT
          // ------------------------------------

          /**
           * GST cannot be affected by:
           *
           * - Exchange
           * - Adjustment grams
           * - Adjustment cost
           */
          gst: gstAmount,

          /**
           * Original value stays intact unless
           * actual pricing inputs change.
           */
          originalCartValue,

          /**
           * Original Cart
           * - Exchange
           *
           * Adjustment is deliberately excluded.
           */
          totalAmount,

          /**
           * Only this field includes adjustmentCost.
           */
          balanceAmount,

          // ------------------------------------
          // STATUS
          // ------------------------------------

          status:
            fields.status ||
            existing.status,
        },

        // ========================================================
        // RETURN EVERYTHING THE CUSTOMER ORDER PAGE NEEDS
        // ========================================================

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

          // ======================================================
          // PAYMENT HISTORY
          // ======================================================

          payments: {
            select: {
              id: true,

              amount: true,

              /**
               * Required for:
               *
               * Cash
               * UPI
               * Card
               * Check
               *
               * breakdown on customer order page.
               */
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

    // ============================================================
    // RESPONSE
    // ============================================================

    return new NextResponse(
      JSON.stringify({
        success: true,

        message:
          "Order updated successfully",

        order:
          updatedOrder,

        calculation: {
          metalCost,

          vaAmount,

          stoneCost,

          gstTaxableBase,

          gstAmount,

          originalCartValue,

          exchangeValue:
            discountAmount,

          payableAfterExchange,

          amountPaid:
            advanceCash,

          balanceBeforeAdjustment,

          weightAdjustmentGrams,

          adjustmentCost,

          finalBalanceDue:
            balanceAmount,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "EDIT_ORDER_ERROR:",
      error
    );

    return new NextResponse(
      JSON.stringify({
        success: false,

        error:
          "Failed to update order",

        details:
          error?.message ||
          "Unknown server error",
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders(),
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}