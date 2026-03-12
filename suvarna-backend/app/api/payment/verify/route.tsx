import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";

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
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purchaseData
    } = body;

    const secret = process.env.RAZORPAY_KEY_SECRET!;

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {

      return new NextResponse(
        JSON.stringify({ error: "Invalid payment signature" }),
        { status: 400, headers: corsHeaders() }
      );

    }

    const purchasePayload: any = {
      customerName: purchaseData.customerName,
      phoneNumber: purchaseData.phoneNumber,
      totalAmount: purchaseData.totalAmount,
      gstAmount: purchaseData.gstAmount,
      discountAmount: purchaseData.discountAmount,
      finalAmount: purchaseData.finalAmount,
      paymentStatus: "SUCCESS",
      paymentId: razorpay_payment_id,
    };

    if (decoded.role === "ADMIN") {
      purchasePayload.adminId = decoded.id;
    }

    if (decoded.role === "SUPER_ADMIN") {
      purchasePayload.superAdminId = decoded.id;
    }

    const purchase = await prisma.$transaction(async (tx) => {

      const createdPurchase = await tx.purchase.create({
        data: purchasePayload,
      });

      for (const item of purchaseData.items) {

        await tx.purchaseItem.create({
          data: {
            purchaseId: createdPurchase.id,
            productId: item.productId,
            name: item.name,
            grams: item.grams,
            cost: item.cost,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: {
            isSold: true,
            soldAt: new Date(),
          },
        });

      }

      return createdPurchase;

    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        purchaseId: purchase.id,
        message: "Payment verified & purchase completed"
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("PAYMENT VERIFY ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Payment verification failed" }),
      { status: 500, headers: corsHeaders() }
    );

  }

}