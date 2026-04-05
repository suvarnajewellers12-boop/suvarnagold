import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: corsHeaders() 
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = verifyToken(token);

    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { 
        status: 403, headers: corsHeaders() 
      });
    }

    const purchases = await prisma.purchase.findMany({
      include: {
        admin: { select: { username: true } },
        superAdmin: { select: { username: true } },
        items: {
          include: {
            product: {
              select: { name: true, metalType: true },
            },
          },
        },
      },
      orderBy: { purchasedAt: "desc" },
    });

    // Flattening while including the new financial fields
    const rows = purchases.flatMap((purchase) => {
      const createdBy = purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items.map((item) => ({
        id: purchase.id, // Purchase UUID
        paymentId: purchase.paymentId || "N/A",
        paymentStatus: purchase.paymentStatus,
        customerName: purchase.customerName,
        phoneNumber: purchase.phoneNumber,
        
        // Financial Fields from the Purchase model
        totalAmount: purchase.totalAmount,
        gstAmount: purchase.gstAmount,
        discountAmount: purchase.discountAmount,
        finalAmount: purchase.finalAmount,

        // Item specific fields
        productName: item.product.name,
        category: item.product.metalType,
        grams: item.grams,
        itemCost: item.cost, // Individual item cost
        
        // Metadata
        purchasedAt: purchase.purchasedAt,
        createdBy: createdBy,
      }));
    });

    return new NextResponse(
      JSON.stringify({ purchases: rows }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (error) {
    console.error("REPORT_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}