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

    const purchaseData: any = {
      customerName: body.customerName,
      phoneNumber: body.phoneNumber,
      totalAmount: body.totalAmount,
      gstAmount: body.gstAmount,
      discountAmount: body.discountAmount,
      finalAmount: body.finalAmount,
      paymentStatus: "SUCCESS",
      paymentId: body.paymentId || null,
    };

    // ADMIN PURCHASE
    if (decoded.role === "ADMIN") {
      purchaseData.adminId = decoded.id;
    }

    // SUPERADMIN PURCHASE
    if (decoded.role === "SUPER_ADMIN") {
      purchaseData.superAdminId = decoded.id;
    }

    const purchase = await prisma.$transaction(async (tx) => {

      const createdPurchase = await tx.purchase.create({
        data: purchaseData,
      });

      for (const item of body.items) {

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
        purchaseId: purchase.id
      }),
      { status: 201, headers: corsHeaders() }
    );

  } catch (error) {

    console.error("PURCHASE CREATE ERROR:", error);

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: corsHeaders() }
    );

  }

}