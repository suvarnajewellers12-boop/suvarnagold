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
    const decoded: any = verifyToken(token);

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
        liveRate: parseFloat(liveRate) || 0,
        givenMetalGrams: parseFloat(givenMetalGrams) || 0,
        addedMetalGrams: parseFloat(addedMetalGrams) || 0,
        stoneWeight: parseFloat(stoneWeight) || 0,
        netWeight: parseFloat(netWeight) || 0,
        grossWeight: parseFloat(grossWeight) || 0,
        vaPercentage: parseFloat(vaPercentage) || 0,
        stoneCost: parseFloat(stoneCost) || 0,
        gst: parseFloat(gstAmount) || 0, // 👈 Check if your schema uses 'gst' or 'gstAmount'
        totalAmount: parseFloat(totalAmount) || 0,
        advanceCash: parseFloat(advanceCash) || 0,
        balanceAmount: parseFloat(balanceAmount) || 0,
        deadlineDate: new Date(deadlineDate),
        status: "NOT ASSIGNED",
        discountAmount: parseFloat(discountAmount) || 0,
        createdBy: decoded.id
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Order created", orderId: order.orderId }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error("Data collection error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
}