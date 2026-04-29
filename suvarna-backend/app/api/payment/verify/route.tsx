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
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();

    const {
      purchaseData,
      paymentBreakdown // This contains { cash, upi, card, cheque }
    } = body;
    const invoiceNumber = `SUVJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // 1. Prepare the Purchase Payload with Multi-Modal logic
    const purchasePayload: any = {
      customerName: purchaseData.customerName,
      phoneNumber: purchaseData.phoneNumber,
      emailid: purchaseData.emailid || null,
      Address: purchaseData.Address || null,

      // Financials
      totalAmount: purchaseData.totalAmount,
      cgstAmount: purchaseData.cgstAmount,
      sgstAmount: purchaseData.sgstAmount,
      discountAmount: purchaseData.discountAmount,
      jewelleryexchangediscount: purchaseData.jewelleryexchangediscount || 0,
      excahngejewellrygrams: purchaseData.excahngejewellrygrams || null,
      excahngejewellryname: purchaseData.excahngejewellryname || null,
      finalAmount: purchaseData.finalAmount,

      // Payment Breakdown (The new fields)
      cashAmount: Number(paymentBreakdown.cash) || 0,
      upiAmount: Number(paymentBreakdown.upi) || 0,
      cardAmount: Number(paymentBreakdown.card) || 0,
      chequeAmount: Number(paymentBreakdown.cheque) || 0,

      // POS Metadata
      paymentStatus: "SUCCESS",
      paymentId: `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoice: invoiceNumber,
    };

    // 2. Assign ownership based on role
    if (decoded.role === "ADMIN") {
      purchasePayload.adminId = decoded.id;
    } else if (decoded.role === "SUPER_ADMIN") {
      purchasePayload.superAdminId = decoded.id;
    }

    // 3. Database Transaction
    const purchase = await prisma.$transaction(async (tx) => {
      
      // Create the main Purchase record
      const createdPurchase = await tx.purchase.create({
        data: purchasePayload,
      });

      // Create individual items linked to this purchase
      const purchaseItems = purchaseData.items.map((item: any) => ({
        purchaseId: createdPurchase.id,
        productId: item.productId,
        name: item.name,
        grams: item.grams,
        cost: item.cost,
      }));

      await tx.purchaseItem.createMany({
        data: purchaseItems
      });

      // Update inventory to mark items as Sold
      const productIds = purchaseData.items.map((i: any) => i.productId);

      await tx.product.updateMany({
        where: {
          id: { in: productIds }
        },
        data: {
          isSold: true,
          soldAt: new Date()
        }
      });

      return createdPurchase;
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        purchaseId: purchase.id,
        message: "Manual POS purchase completed successfully"
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("POS PURCHASE ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to process manual purchase" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}