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
              select: { 
                name: true, 
                metalType: true,
                carats: true,      // For PURITY
                grams: true,       // For GROSS WT
                netWeight: true,   // For NET WT
                va: true,          // For VA (Making charge)
                huid: true,
                sku: true,        // For HUID
              },
            },
          },
        },
      },
      orderBy: { purchasedAt: "desc" },
    });

    const rows = purchases.flatMap((purchase) => {
      const createdBy = purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items.map((item) => ({
        id: purchase.id,
        paymentId: purchase.paymentId || "N/A",
        paymentStatus: purchase.paymentStatus,
        customerName: purchase.customerName,
        phoneNumber: purchase.phoneNumber,
        Address: purchase.Address || "N/A",
        emailid: purchase.emailid || "N/A",
        jewelleryexchangediscount:purchase.jewelleryexchangediscount,
        excahngejewellrygrams:purchase.excahngejewellrygrams,
        excahngejewellryname:purchase.excahngejewellryname,
        cardAmount: purchase.cardAmount,
        upiAmount: purchase.upiAmount,
        chequeAmount: purchase.chequeAmount,
        cashAmount: purchase.cashAmount,
        totalAmount: purchase.totalAmount,
        cgstAmount: purchase.cgstAmount,
        sgstAmount: purchase.sgstAmount,
        discountAmount: purchase.discountAmount,
        finalAmount: purchase.finalAmount,

        // Item specific fields (Direct & Product relations)
        productName: item.product.name,
        category: item.product.metalType,
        purity: item.product.carats,       // Added
        grossWt: item.product.grams,       // Added
        netWt: item.product.netWeight,     // Added
        va: item.product.va,               // Added
        huid: item.product.huid || "N/A",  // Added
        grams: item.grams,                 // Actual weight sold
        itemCost: item.cost,               // Product Value
        sku: item.product.sku || "N/A",    // Added
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