import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as { id: string; role: string };

    if (decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
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
      netWeight, // grams required to make the item (sent from form.requiredGrams)
      stoneWeight,
      vaPercentage,
      stoneCost,
      gstAmount,
      originalCartValue,
      exchangeJewelleryName,
      exchangeJewelleryGrams,
      totalAmount,
      advanceCash,
      balanceAmount,
      discountAmount,
      deadlineDate,
    } = body;

    if (!netWeight || parseFloat(netWeight) <= 0) {
      return new NextResponse(
        JSON.stringify({ error: "Grams required to make the item must be greater than 0" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // --- GENERATE ORDER ID ---
    const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: "desc" } });
    const nextNumber = lastOrder ? parseInt(lastOrder.orderId.replace("OR-", "")) + 1 : 1001;
    const orderId = `OR-${nextNumber}`;

    const liveRateValue = parseFloat(liveRate) || 0;
    const netWeightValue = parseFloat(netWeight) || 0;
    const stoneWeightValue = parseFloat(stoneWeight) || 0;
    const vaPercentageValue = parseFloat(vaPercentage) || 0;
    const stoneCostValue = parseFloat(stoneCost) || 0;
    const discountAmountValue = parseFloat(discountAmount) || 0;

    const goldValue = netWeightValue * liveRateValue;
    const vaAmount = goldValue * (vaPercentageValue / 100);
    const subtotalBase = goldValue + vaAmount + stoneCostValue;
    const derivedOriginalCartValue = subtotalBase + subtotalBase * 0.03;

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
        netWeight: netWeightValue,          // grams required to make (final weight is netWeight + weightAdjustmentGrams)
        grossWeight: parseFloat(body.grossWeight) || netWeightValue + stoneWeightValue,
        stoneWeight: stoneWeightValue,
        vaPercentage: vaPercentageValue,
        stoneCost: stoneCostValue,
        gst: parseFloat(gstAmount) || 0,
        originalCartValue: parseFloat(originalCartValue) || derivedOriginalCartValue,
        exchangeJewelleryName: exchangeJewelleryName || null,
        exchangeJewelleryGrams: parseFloat(exchangeJewelleryGrams) || 0,
        totalAmount: parseFloat(totalAmount) || 0,
        advanceCash: parseFloat(advanceCash) || 0,
        balanceAmount: parseFloat(balanceAmount) || 0,
        weightAdjustmentGrams: 0, // set later via edit API once crafting is done
        adjustmentCost: 0,
        deadlineDate: new Date(deadlineDate),
        status: "NOT ASSIGNED",
        discountAmount: discountAmountValue,
        createdBy: decoded.id,
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Order created", orderId: order.orderId }),
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