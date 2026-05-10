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
    // 1. Auth & Verification
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

    // 2. Calculate Today's Range (IST Focus)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 3. Fetch Data with Date Filter
    const purchases = await prisma.purchase.findMany({
      where: {
        purchasedAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      include: {
        admin: { select: { username: true } },
        superAdmin: { select: { username: true } },
        items: {
          include: {
            product: true, // Simplified include for clarity, adjust as needed
          },
        },
      },
      orderBy: { purchasedAt: "desc" },
    });

    // 4. Flatten Items into Rows (As per your inspiration)
    const rows = purchases.flatMap((purchase) => {
      const createdBy = purchase.admin?.username || purchase.superAdmin?.username || "SYSTEM";

      return purchase.items.map((item) => ({
        id: purchase.id,
        invoice: purchase.invoice,
        customerName: purchase.customerName,
        phoneNumber: purchase.phoneNumber,
        Address: purchase.Address || "N/A",
        emailid: purchase.emailid || "N/A",
        
        // Payment split for the "Settlement Method" badges in your table
        payments: {
          cash: purchase.cashAmount || 0,
          upi: purchase.upiAmount || 0,
          card: purchase.cardAmount || 0,
          cheque: purchase.chequeAmount || 0,
        },

        // Financials
        subtotal: purchase.totalAmount,
        cgst: purchase.cgstAmount,
        sgst: purchase.sgstAmount,
        discount: purchase.discountAmount,
        couponDiscount: purchase.couponDiscount,
        exchangeDiscount: purchase.jewelleryexchangediscount,
        grandTotal: purchase.finalAmount,

        // Item specific fields
        productName: item.product.name,
        grams: item.product.grams,
        category: item.product.metalType,
        purity: item.product.carats,
        grossWt: item.product.grams,
        netWt: item.product.netWeight,
        va: item.product.va,
        huid: item.product.huid || "N/A",
        sku: item.product.sku || "N/A",
        itemCost: item.cost,
        
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
    console.error("TODAYS_PURCHASE_ERROR:", error);
    return new NextResponse(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
}