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
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded: any = verifyToken(
      authHeader.slice(7)
    );

    if (
      !decoded ||
      (decoded.role !== "SUPER_ADMIN" &&
        decoded.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const { orderId, ...fields } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (existing.status === "DELIVERED") {
      return NextResponse.json(
        {
          error: "Cannot edit an order that has already been delivered",
        },
        { status: 409, headers: corsHeaders() }
      );
    }

    const editable = [
      "customerName",
      "phoneNumber",
      "itemName",
      "itemDescription",

      "metalType",
      "purity",
      "pricingMode",
      "pieceCost",

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

    const merged: any = {
      ...existing,
    };

    for (const key of editable) {
      if (
        Object.prototype.hasOwnProperty.call(
          fields,
          key
        )
      ) {
        merged[key] = fields[key];
      }
    }

    const metalType =
      String(merged.metalType || "").toUpperCase();

    const purity =
      String(merged.purity || "");

    const requestedPricingMode =
      String(
        merged.pricingMode ||
          existing.pricingMode ||
          "GRAMS"
      ).toUpperCase() === "PIECE"
        ? "PIECE"
        : "GRAMS";

    const isPieceCost =
      metalType === "SILVER" &&
      purity === "92.5" &&
      requestedPricingMode === "PIECE";

    const pricingMode =
      isPieceCost
        ? "PIECE"
        : "GRAMS";

    const pieceCost =
      isPieceCost
        ? Math.max(0, num(merged.pieceCost))
        : 0;

    if (isPieceCost && pieceCost <= 0) {
      return NextResponse.json(
        {
          error: "Piece Cost must be greater than 0 for 92.5 silver piece pricing",
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const netWeight =
      isPieceCost
        ? 0
        : Math.max(0, num(merged.netWeight));

    if (!isPieceCost && netWeight <= 0) {
      return NextResponse.json(
        {
          error: "Net Weight must be greater than 0 for grams pricing",
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const liveRate =
      isPieceCost
        ? 0
        : Math.max(0, num(merged.liveRate));

    const vaPercentage =
      isPieceCost
        ? 0
        : Math.max(0, num(merged.vaPercentage));

    const stoneWeight =
      Math.max(0, num(merged.stoneWeight));

    const stoneCost =
      Math.max(0, num(merged.stoneCost));

    const discountAmount =
      Math.max(0, num(merged.discountAmount));

    const weightAdjustmentGrams =
      num(merged.weightAdjustmentGrams);

    const adjustmentCost =
      num(merged.adjustmentCost);

    // ------------------------------------------------------------
    // NEW PRICING
    // ------------------------------------------------------------
    const metalValue = roundMoney(
      isPieceCost
        ? pieceCost
        : netWeight * liveRate
    );

    const vaAmount =
      isPieceCost
        ? 0
        : roundMoney(
            metalValue *
              (vaPercentage / 100)
          );

    const gstTaxableBase =
      roundMoney(
        metalValue +
          vaAmount +
          stoneCost
      );

    const gst =
      roundMoney(
        gstTaxableBase * 0.03
      );

    const originalCartValue =
      roundMoney(
        gstTaxableBase +
          gst
      );

    const totalAmount =
      roundMoney(
        Math.max(
          0,
          originalCartValue -
            discountAmount
        )
      );

    // ------------------------------------------------------------
    // PRICING REVISION AUDIT
    // ------------------------------------------------------------
    const previousOriginal =
      Math.max(
        0,
        num(existing.originalCartValue)
      );

    const pricingRevisionAmount =
      roundMoney(
        originalCartValue -
          previousOriginal
      );

    const changedPricingFields: string[] = [];

    const changed = (
      key: string,
      oldValue: any,
      nextValue: any
    ) =>
      Object.prototype.hasOwnProperty.call(
        fields,
        key
      ) &&
      String(oldValue ?? "") !==
        String(nextValue ?? "");

    if (
      changed(
        "pricingMode",
        existing.pricingMode,
        pricingMode
      )
    ) {
      changedPricingFields.push(
        `pricing mode: ${pricingMode}`
      );
    }

    if (
      changed(
        "pieceCost",
        existing.pieceCost,
        pieceCost
      )
    ) {
      changedPricingFields.push(
        `piece cost ₹${pieceCost.toLocaleString()}`
      );
    }

    if (
      changed(
        "netWeight",
        existing.netWeight,
        netWeight
      )
    ) {
      changedPricingFields.push(
        `net weight ${netWeight}g`
      );
    }

    if (
      changed(
        "liveRate",
        existing.liveRate,
        liveRate
      )
    ) {
      changedPricingFields.push(
        `live rate ₹${liveRate.toLocaleString()}`
      );
    }

    if (
      changed(
        "vaPercentage",
        existing.vaPercentage,
        vaPercentage
      )
    ) {
      changedPricingFields.push(
        `VA ${vaPercentage}%`
      );
    }

    if (
      changed(
        "stoneWeight",
        existing.stoneWeight,
        stoneWeight
      )
    ) {
      changedPricingFields.push(
        `stone weight ${stoneWeight}g`
      );
    }

    if (
      changed(
        "stoneCost",
        existing.stoneCost,
        stoneCost
      )
    ) {
      changedPricingFields.push(
        `stone cost ₹${stoneCost.toLocaleString()}`
      );
    }

    if (
      changed(
        "discountAmount",
        existing.discountAmount,
        discountAmount
      )
    ) {
      changedPricingFields.push(
        `exchange ₹${discountAmount.toLocaleString()}`
      );
    }

    const pricingRevisionNote =
      changedPricingFields.length
        ? changedPricingFields.join(" • ")
        : existing.pricingRevisionNote;

    // ------------------------------------------------------------
    // BALANCE AFTER EDIT
    // ------------------------------------------------------------
    // advanceCash is the cached sum of actual money received.
    //
    // If the order was previously fully paid and the new pricing is higher,
    // only the price difference becomes Balance Due.
    //
    // If the new pricing is lower than money already received, Balance Due
    // remains zero — no fake positive balance is created.
    const paidAmount =
      Math.max(
        0,
        num(existing.advanceCash)
      );

    const balanceBeforeAdjustment =
      roundMoney(
        Math.max(
          0,
          totalAmount -
            paidAmount
        )
      );

    const balanceAmount =
      roundMoney(
        Math.max(
          0,
          balanceBeforeAdjustment +
            adjustmentCost
        )
      );

    const finalPhysicalNetWeight =
      netWeight +
      weightAdjustmentGrams;

    const grossWeight =
      isPieceCost
        ? stoneWeight
        : roundMoney(
            finalPhysicalNetWeight +
              stoneWeight
          );

    let deadlineDate =
      existing.deadlineDate;

    if (
      Object.prototype.hasOwnProperty.call(
        fields,
        "deadlineDate"
      )
    ) {
      if (!fields.deadlineDate) {
        deadlineDate = null;
      } else {
        const parsed =
          new Date(fields.deadlineDate);

        if (
          Number.isNaN(
            parsed.getTime()
          )
        ) {
          return NextResponse.json(
            {
              error: "Invalid deadline date",
            },
            {
              status: 400,
              headers: corsHeaders(),
            }
          );
        }

        deadlineDate = parsed;
      }
    }

    const updatedOrder =
      await prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          customerName:
            merged.customerName,
          phoneNumber:
            merged.phoneNumber,
          itemName:
            merged.itemName,
          itemDescription:
            merged.itemDescription,

          metalType,
          purity,

          pricingMode,
          pieceCost,

          liveRate,
          netWeight,
          stoneWeight,
          grossWeight,
          vaPercentage,
          stoneCost,

          gst,
          originalCartValue,

          discountAmount,
          exchangeJewelleryName:
            merged.exchangeJewelleryName,
          exchangeJewelleryGrams:
            Math.max(
              0,
              num(
                merged.exchangeJewelleryGrams
              )
            ),

          totalAmount,

          weightAdjustmentGrams,
          adjustmentCost,

          pricingRevisionAmount:
            changedPricingFields.length
              ? pricingRevisionAmount
              : existing.pricingRevisionAmount,

          pricingRevisionNote,

          balanceAmount,

          deadlineDate,

          status:
            fields.status ||
            existing.status,
        },
        include: {
          payments: {
            orderBy: {
              paidAt: "asc",
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,
        message: "Order updated",
        order: updatedOrder,
        calculation: {
          pricingMode,
          metalValue,
          pieceCost,
          netWeight,
          liveRate,
          vaPercentage,
          vaAmount,
          stoneWeight,
          stoneCost,
          gstTaxableBase,
          gst,
          previousOriginalCartValue:
            previousOriginal,
          originalCartValue,
          pricingRevisionAmount:
            changedPricingFields.length
              ? pricingRevisionAmount
              : 0,
          pricingRevisionNote:
            changedPricingFields.join(" • "),
          exchangeValue:
            discountAmount,
          totalAmount,
          amountAlreadyPaid:
            paidAmount,
          balanceBeforeAdjustment,
          adjustmentCost,
          balanceAmount,
        },
      },
      {
        status: 200,
        headers: corsHeaders(),
      }
    );
  } catch (error: any) {
    console.error(
      "EDIT_ORDER_ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to update order",
        details:
          error?.message ||
          "Unknown server error",
      },
      {
        status: 500,
        headers: corsHeaders(),
      }
    );
  }
}
