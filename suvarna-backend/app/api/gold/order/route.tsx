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
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
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
      givenMetalGrams,
      addedMetalGrams,
      stoneWeight,
      netWeight,
      grossWeight,
      vaPercentage,
      stoneCost,
      gstAmount, // Ensure your frontend sends 'gstAmount'
      originalCartValue,
      exchangeJewelleryName,
      exchangeJewelleryGrams,
      totalAmount,
      advanceCash,
      balanceAmount,
      discountAmount,
      deadlineDate
    } = body;

    // --- GENERATE ORDER ID ---
    // This finds the last order to increment the number (e.g., OR-1001, OR-1002)
    const lastOrder = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
    });
    
    const nextNumber = lastOrder ? parseInt(lastOrder.orderId.replace("OR-", "")) + 1 : 1001;
    const orderId = `OR-${nextNumber}`;

    const liveRateValue = parseFloat(liveRate) || 0;
    const netWeightValue = parseFloat(netWeight) || 0;
    const vaPercentageValue = parseFloat(vaPercentage) || 0;
    const stoneCostValue = parseFloat(stoneCost) || 0;
    const discountAmountValue = parseFloat(discountAmount) || 0;
    const derivedOriginalCartValue =
      (netWeightValue * liveRateValue) +
      ((netWeightValue * liveRateValue) * (vaPercentageValue / 100)) +
      stoneCostValue +
      (((netWeightValue * liveRateValue) + ((netWeightValue * liveRateValue) * (vaPercentageValue / 100)) + stoneCostValue) * 0.03);

    // --- SAVE TO DB ---
    const order = await prisma.order.create({
      data: {
        orderId, // 👈 This was missing!
        customerName,
        phoneNumber,
        itemName,
        itemDescription: itemDescription || null,
        metalType,
        purity,
        liveRate: liveRateValue,
        givenMetalGrams: parseFloat(givenMetalGrams) || 0,
        addedMetalGrams: parseFloat(addedMetalGrams) || 0,
        stoneWeight: parseFloat(stoneWeight) || 0,
        netWeight: netWeightValue,
        grossWeight: parseFloat(grossWeight) || 0,
        vaPercentage: vaPercentageValue,
        stoneCost: stoneCostValue,
        gst: parseFloat(gstAmount) || 0, // 👈 Check if your schema uses 'gst' or 'gstAmount'
        originalCartValue: parseFloat(originalCartValue) || derivedOriginalCartValue,
        exchangeJewelleryName: exchangeJewelleryName || null,
        exchangeJewelleryGrams: parseFloat(exchangeJewelleryGrams) || 0,
        totalAmount: parseFloat(totalAmount) || 0,
        advanceCash: parseFloat(advanceCash) || 0,
        balanceAmount: parseFloat(balanceAmount) || 0,
        deadlineDate: new Date(deadlineDate),
        status: "NOT ASSIGNED",
        discountAmount: discountAmountValue,
        createdBy: decoded.id
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